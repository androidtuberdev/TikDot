require('dotenv').config();

const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { TEMP_DIR } = require('./src/config/constants');
const { handleMessage, cleanTemp } = require('./src/handlers/message');

// Asegura que exista /temp y no queden restos de una ejecución anterior
fs.mkdirSync(TEMP_DIR, { recursive: true });
cleanTemp();

const client = new Client({
  authStrategy: new LocalAuth(),
  // whatsapp-web.js sobrescribe la ruta global de fluent-ffmpeg con 'ffmpeg' al crear el Client,
  // por eso hay que pasarla aquí también.
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },

  // NOTA: Esta configuración se usará para el despliegue en Termux (Android).
  // Descomenta este bloque (y comenta el de arriba) cuando ejecutes el bot en el teléfono,
  // usando el Chromium instalado con `pkg install chromium`.
  // puppeteer: {
  //   executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
  //   args: ['--no-sandbox'],
  // },
});

client.on('qr', (qr) => {
  console.log('Escanea este código QR con WhatsApp (Dispositivos vinculados):');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => console.log('Autenticado.'));
client.on('auth_failure', (m) => console.error('Fallo de autenticación:', m));
client.on('ready', () => console.log('Bot listo. Envía un enlace de TikTok.'));
client.on('disconnected', (reason) => console.warn('Desconectado:', reason));

client.on('message', handleMessage(client));

client.initialize();
