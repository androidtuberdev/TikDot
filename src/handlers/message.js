const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const {
  TIKTOK_REGEX,
  STICKER_URL_REGEX,
  ORIGINAL_FLAG_REGEX,
  VIDEO_IN_PATH,
  STICKER_OUT_PATH,
  STICKER,
  HUMANIZE,
} = require('../config/constants');
const { downloadTikTok, downloadSticker } = require('../services/tiktok');
const { convertToSticker } = require('../services/ffmpeg');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = ([min, max]) => sleep(Math.floor(min + Math.random() * (max - min)));

/** Elimina los archivos temporales (seguro si no existen). */
function cleanTemp() {
  for (const file of [VIDEO_IN_PATH, STICKER_OUT_PATH]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (err) {
      console.error(`[cleanup] No se pudo borrar ${file}:`, err.message);
    }
  }
}

// Los archivos temporales tienen nombre fijo, así que se procesa un enlace a la vez.
let queue = Promise.resolve();
const sleepBetweenJobs = () => randomDelay(HUMANIZE.BETWEEN_JOBS_MS);

/**
 * @param {{ kind: 'video'|'sticker', url: string, crop: boolean }} job
 */
async function processJob(client, msg, { kind, url, crop }) {
  let chat = null;
  try {
    // Simula comportamiento humano: espera, marca como leído y luego procesa
    await randomDelay(HUMANIZE.READ_DELAY_MS);
    chat = await msg.getChat().catch(() => null);
    if (chat) await chat.sendSeen().catch(() => {});

    if (kind === 'sticker') {
      // Los stickers de TikTok ya son cuadrados: no hace falta cropdetect
      await downloadSticker(url);
      await convertToSticker({ crop: true, detect: false });
    } else {
      await downloadTikTok(url);
      await convertToSticker({ crop });
    }

    // "escribiendo..." y pausa antes de enviar
    if (chat) await chat.sendStateTyping().catch(() => {});
    await randomDelay(HUMANIZE.SEND_DELAY_MS);

    const media = MessageMedia.fromFilePath(STICKER_OUT_PATH);
    await client.sendMessage(msg.from, media, {
      sendMediaAsSticker: true,
      stickerName: STICKER.NAME,
      stickerAuthor: STICKER.AUTHOR,
      quotedMessageId: msg.id._serialized,
    });
  } catch (err) {
    console.error('[bot] Error:', err.message);
    const what = kind === 'sticker' ? 'ese sticker (¿el enlace expiró?)' : 'ese TikTok en sticker';
    await msg.reply(`❌ No pude convertir ${what}. Intenta con otro enlace.`).catch(() => {});
  } finally {
    cleanTemp(); // siempre, incluso si falló algo
    if (chat) await chat.clearState().catch(() => {});
  }
}

/**
 * Handler del evento 'message'.
 */
function handleMessage(client) {
  return async (msg) => {
    if (!msg.body) return;

    // Enlace directo a un sticker de TikTok (.awebp) tiene prioridad sobre el enlace de video
    const stickerMatch = msg.body.match(STICKER_URL_REGEX);
    const videoMatch = stickerMatch ? null : msg.body.match(TIKTOK_REGEX);
    if (!stickerMatch && !videoMatch) return;

    const kind = stickerMatch ? 'sticker' : 'video';
    const url = (stickerMatch || videoMatch)[0];
    // Por defecto se recorta a cuadrado; con "-o" se conserva el video original (con padding)
    const crop = !ORIGINAL_FLAG_REGEX.test(msg.body);
    console.log(`[bot] ${kind} recibido de ${msg.from}: ${url} (${crop ? 'recorte' : 'original'})`);

    // Tras cada trabajo se hace una pausa aleatoria antes de atender el siguiente
    queue = queue.then(() => processJob(client, msg, { kind, url, crop })).then(sleepBetweenJobs);
    return queue;
  };
}

module.exports = { handleMessage, cleanTemp };
