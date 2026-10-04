const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { VIDEO_IN_PATH, STICKER_OUT_PATH, STICKER, CROPDETECT } = require('../config/constants');

// Permite indicar un binario concreto (útil en Windows o Termux) vía .env
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);

/**
 * Pre-análisis con cropdetect: busca bordes negros "incrustados" en el video.
 * Muestrea los primeros segundos y une (bounding box) todas las áreas detectadas,
 * así nunca se corta contenido real aunque haya fotogramas oscuros.
 * @returns {Promise<{w:number,h:number,x:number,y:number}|null>} null si no hay bordes que quitar
 */
function detectContentBounds() {
  return new Promise((resolve) => {
    let fullW = 0;
    let fullH = 0;
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = 0;
    let y2 = 0;
    let frames = 0;

    const onStderr = (line) => {
      const size = line.match(/Video:.*?,\s*(\d{2,5})x(\d{2,5})[\s,[]/);
      if (size && !fullW) {
        fullW = Number(size[1]);
        fullH = Number(size[2]);
      }
      const m = line.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
      if (m) {
        const [w, h, x, y] = m.slice(1).map(Number);
        if (w <= 0 || h <= 0) return;
        frames++;
        x1 = Math.min(x1, x);
        y1 = Math.min(y1, y);
        x2 = Math.max(x2, x + w);
        y2 = Math.max(y2, y + h);
      }
    };

    const finish = () => {
      if (!fullW || !fullH || frames === 0) return resolve(null);
      const w = x2 - x1;
      const h = y2 - y1;
      const ratio = (w * h) / (fullW * fullH);
      // Sin bordes relevantes, o detección sospechosa (casi todo el video): no se toca
      if (ratio >= CROPDETECT.MAX_AREA_RATIO || ratio <= CROPDETECT.MIN_AREA_RATIO) return resolve(null);
      resolve({ w, h, x: x1, y: y1 });
    };

    ffmpeg(VIDEO_IN_PATH)
      .noAudio()
      .duration(CROPDETECT.SAMPLE_SECONDS)
      .videoFilters([
        `fps=${CROPDETECT.SAMPLE_FPS}`,
        `cropdetect=limit=${CROPDETECT.LIMIT}:round=${CROPDETECT.ROUND}:reset=0`,
      ])
      .format('null')
      .on('stderr', onStderr)
      .on('error', () => resolve(null)) // si falla la detección, se sigue sin ella
      .on('end', finish)
      .output('-')
      .run();
  });
}

/**
 * Filtro de video (siempre termina en 512x512 exactos):
 *  - fps limitado (10-15)
 *  - modo recorte (por defecto): quita bordes negros detectados (cropdetect), luego
 *    scale con force_original_aspect_ratio=increase + crop centrado, sin franjas vacías
 *  - modo original (-o): scale con force_original_aspect_ratio=decrease + pad transparente centrado,
 *    conserva todo el encuadre (sin cropdetect)
 *  - setsar=1 para evitar píxeles no cuadrados
 */
function buildFilter(fps, crop, bounds) {
  const s = STICKER.SIZE;
  const trim = crop && bounds ? [`crop=${bounds.w}:${bounds.h}:${bounds.x}:${bounds.y}`] : [];
  const fit = crop
    ? [`scale=${s}:${s}:force_original_aspect_ratio=increase:flags=lanczos`, `crop=${s}:${s}`]
    : [
        `scale=${s}:${s}:force_original_aspect_ratio=decrease:flags=lanczos`,
        'format=rgba',
        `pad=${s}:${s}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
      ];
  return [`fps=${fps}`, ...trim, ...fit, 'setsar=1'].join(',');
}

function runConversion({ fps, quality, duration }, crop, bounds) {
  return new Promise((resolve, reject) => {
    ffmpeg(VIDEO_IN_PATH)
      .noAudio() // -an
      .duration(duration)
      .videoFilters(buildFilter(fps, crop, bounds))
      .outputOptions([
        '-vcodec libwebp',
        '-loop 0', // animación infinita
        '-lossless 0',
        `-q:v ${quality}`,
        '-compression_level 6',
        '-preset default',
      ])
      .format('webp')
      .on('error', (err) => reject(err))
      .on('end', () => resolve())
      .save(STICKER_OUT_PATH);
  });
}

/**
 * Convierte temp/video_in.mp4 -> temp/sticker_out.webp (512x512, sin audio, 10-15 fps, <500 KB).
 * Reintenta con más compresión hasta cumplir el límite de peso.
 * @param {{ crop?: boolean, detect?: boolean }} [options] crop=true (por defecto) quita bordes negros y recorta a cuadrado; false conserva el encuadre original. detect=false omite cropdetect (p. ej. stickers, que ya son cuadrados)
 * @returns {Promise<string>} ruta del WebP generado
 */
async function convertToSticker({ crop = true, detect = true } = {}) {
  if (!fs.existsSync(VIDEO_IN_PATH)) throw new Error('No existe temp/video_in.mp4.');

  const bounds = crop && detect ? await detectContentBounds() : null;
  if (bounds) console.log(`[ffmpeg] Bordes detectados, área útil: ${bounds.w}x${bounds.h}+${bounds.x}+${bounds.y}`);

  for (const attempt of STICKER.ATTEMPTS) {
    await runConversion(attempt, crop, bounds);
    const size = fs.statSync(STICKER_OUT_PATH).size;
    if (size > 0 && size < STICKER.MAX_BYTES) return STICKER_OUT_PATH;
  }

  throw new Error('No se pudo comprimir el sticker por debajo de 500 KB.');
}

module.exports = { convertToSticker };
