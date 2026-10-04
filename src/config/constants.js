const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const TEMP_DIR = path.join(ROOT_DIR, 'temp');

module.exports = {
  ROOT_DIR,
  TEMP_DIR,

  // Archivos temporales fijos (se procesa un enlace a la vez, ver message.js)
  VIDEO_IN_PATH: path.join(TEMP_DIR, 'video_in.mp4'),
  STICKER_OUT_PATH: path.join(TEMP_DIR, 'sticker_out.webp'),

  // Detecta tiktok.com, www.tiktok.com, vm.tiktok.com, vt.tiktok.com, m.tiktok.com, etc.
  TIKTOK_REGEX: /https?:\/\/(?:[a-z0-9-]+\.)?tiktok\.com\/[^\s]+/i,

  // Enlace directo a un sticker de TikTok (.awebp en el CDN de ByteDance), p. ej. al arrastrarlo desde TikTok web.
  // Excluye ) y ] finales por si se pega en formato Markdown.
  STICKER_URL_REGEX: /https?:\/\/[^\s)\]]*ibyteimg\.com[^\s)\]]*\.awebp[^\s)\]]*/i,

  // Detección automática de bordes negros (cropdetect) en modo recorte
  CROPDETECT: {
    SAMPLE_SECONDS: 5, // cuántos segundos del video se analizan
    SAMPLE_FPS: 4, // fotogramas por segundo analizados
    LIMIT: 24, // umbral de "negro" (0-255); más alto = más agresivo
    ROUND: 2, // medidas múltiplos de 2
    MAX_AREA_RATIO: 0.97, // si el área útil es >=97% del video, no hay bordes que quitar
    MIN_AREA_RATIO: 0.2, // si es <=20%, la detección es sospechosa y se ignora
  },

  // Flag "-o" (en cualquier parte del mensaje): no recortar, conservar el video original con padding
  ORIGINAL_FLAG_REGEX: /(?:^|\s)-o(?=\s|$)/i,

  // Latencia aleatoria "humana" (ms) para reducir el riesgo de detección/baneo
  HUMANIZE: {
    READ_DELAY_MS: [1000, 3000], // espera antes de empezar a procesar el mensaje
    SEND_DELAY_MS: [1500, 4000], // "escribiendo..." antes de enviar el sticker
    BETWEEN_JOBS_MS: [3000, 6000], // pausa entre un enlace y el siguiente de la cola
  },

  // API sin marca de agua
  TIKWM_API_URL: 'https://www.tikwm.com/api/',
  HTTP_TIMEOUT_MS: 30000,
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',

  // Reglas estrictas de stickers animados de WhatsApp
  STICKER: {
    SIZE: 512,
    MAX_BYTES: 500 * 1024,
    // Intentos progresivos: si el WebP pesa >= 500 KB se reintenta con más compresión.
    // fps se mantiene dentro del rango 10-15.
    ATTEMPTS: [
      { fps: 15, quality: 50, duration: 8 },
      { fps: 12, quality: 40, duration: 8 },
      { fps: 10, quality: 30, duration: 7 },
      { fps: 10, quality: 20, duration: 6 },
      { fps: 10, quality: 12, duration: 5 },
      { fps: 10, quality: 5, duration: 4 },
    ],
    NAME: 'TikDot',
    AUTHOR: 'DonaDev',
  },
};
