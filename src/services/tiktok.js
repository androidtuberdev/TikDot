const fs = require('fs');
const axios = require('axios');
const { pipeline } = require('stream/promises');
const {
  TEMP_DIR,
  VIDEO_IN_PATH,
  TIKWM_API_URL,
  HTTP_TIMEOUT_MS,
  USER_AGENT,
} = require('../config/constants');

/**
 * Consulta la API de TikWM y devuelve la URL directa del MP4 sin marca de agua.
 */
async function resolveNoWatermarkUrl(tiktokUrl) {
  const { data } = await axios.get(TIKWM_API_URL, {
    params: { url: tiktokUrl, hd: 0 },
    headers: { 'User-Agent': USER_AGENT },
    timeout: HTTP_TIMEOUT_MS,
  });

  if (!data || data.code !== 0 || !data.data) {
    throw new Error(`TikWM no pudo resolver el video: ${data && data.msg ? data.msg : 'respuesta inválida'}`);
  }

  // `play` = sin marca de agua; `wmplay` = con marca de agua (no se usa)
  let videoUrl = data.data.play;
  if (!videoUrl) throw new Error('TikWM no devolvió URL de video (¿es un álbum de fotos?).');

  if (videoUrl.startsWith('/')) videoUrl = new URL(videoUrl, 'https://www.tikwm.com').href;
  return videoUrl;
}

/**
 * Descarga el video sin marca de agua a temp/video_in.mp4.
 * @returns {Promise<string>} ruta del archivo descargado
 */
async function downloadTikTok(tiktokUrl) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const videoUrl = await resolveNoWatermarkUrl(tiktokUrl);

  const response = await axios.get(videoUrl, {
    responseType: 'stream',
    headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.tikwm.com/' },
    timeout: HTTP_TIMEOUT_MS,
  });

  await pipeline(response.data, fs.createWriteStream(VIDEO_IN_PATH));

  if (!fs.existsSync(VIDEO_IN_PATH) || fs.statSync(VIDEO_IN_PATH).size === 0) {
    throw new Error('El video descargado está vacío.');
  }

  return VIDEO_IN_PATH;
}

module.exports = { downloadTikTok };
