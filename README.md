# TikDot

Bot de WhatsApp que recibe enlaces de TikTok, descarga el video **sin marca de agua** y lo devuelve como **sticker animado**.

> ⚠️ Usa [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), una librería **no oficial**. WhatsApp puede restringir o banear la cuenta usada. Se recomienda un número secundario. Proyecto con fines educativos.

## Características

- Detecta enlaces `tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`, etc. en cualquier mensaje.
- Descarga sin marca de agua mediante la API de [TikWM](https://www.tikwm.com/).
- Convierte a WebP animado cumpliendo las reglas de WhatsApp: **512×512 px**, **sin audio**, **10–15 fps**, **< 500 KB** (reintenta con más compresión si hace falta).
- **Recorte inteligente:** detecta bordes negros incrustados con `cropdetect`, los elimina y recorta a cuadrado.
- Flag `-o` para conservar el video original (sin recortar, con relleno transparente).
- Latencia aleatoria "humana" (marcar como leído, "escribiendo…", pausas entre trabajos) para reducir el riesgo de detección.
- Limpieza automática de archivos temporales en un bloque `finally`.
- Autenticación local persistente (`LocalAuth`): el QR se escanea una sola vez.

## Uso

Envía un mensaje al bot (o desde otro chat donde esté activo):

| Mensaje | Resultado |
| --- | --- |
| `https://vt.tiktok.com/XXXX/` | Sticker recortado a cuadrado (sin bordes negros) |
| `-o https://vt.tiktok.com/XXXX/` | Sticker con el encuadre original (relleno transparente) |

El flag `-o` puede ir antes o después del enlace.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior
- [FFmpeg](https://ffmpeg.org/) con soporte `libwebp`
- Google Chrome / Chromium (Puppeteer lo descarga automáticamente en PC)

## Instalación

```bash
git clone https://github.com/<tu-usuario>/TikDot.git
cd TikDot
npm install
cp .env.example .env
```

Instala FFmpeg:

```bash
# Windows
winget install Gyan.FFmpeg
# Debian/Ubuntu
sudo apt install ffmpeg
# macOS
brew install ffmpeg
```

Si FFmpeg no está en el `PATH`, indica su ruta en `.env`:

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

## Ejecución

```bash
npm start
```

Escanea el código QR que aparece en la terminal desde **WhatsApp → Dispositivos vinculados**. La sesión se guarda en `.wwebjs_auth/`.

## Despliegue en Termux (Android)

```bash
pkg update && pkg upgrade
pkg install nodejs git ffmpeg chromium
git clone https://github.com/<tu-usuario>/TikDot.git
cd TikDot
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

En [`index.js`](index.js), comenta la configuración de `puppeteer` activa y descomenta la de Termux:

```js
puppeteer: {
  executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
  args: ['--no-sandbox'],
},
```

Después, `npm start`.

## Estructura

```
.
├── index.js                  # Punto de entrada: cliente de WhatsApp y QR
├── src/
│   ├── config/constants.js   # Regex, límites del sticker, cropdetect, latencias
│   ├── handlers/message.js   # Intercepción de mensajes y orquestación del flujo
│   └── services/
│       ├── tiktok.js         # Descarga sin marca de agua (TikWM + axios)
│       └── ffmpeg.js         # cropdetect y conversión a WebP animado
└── temp/                     # Archivos temporales (se borran tras cada envío)
```

## Configuración

Todo se ajusta en [`src/config/constants.js`](src/config/constants.js):

| Opción | Descripción |
| --- | --- |
| `STICKER.ATTEMPTS` | Intentos de fps / calidad / duración hasta bajar de 500 KB |
| `STICKER.NAME` / `STICKER.AUTHOR` | Metadatos del sticker |
| `CROPDETECT` | Umbral y muestreo de la detección de bordes negros |
| `HUMANIZE` | Rangos de latencia aleatoria (ms) |
| `ORIGINAL_FLAG_REGEX` | Flag para desactivar el recorte |

## Notas

- Los mensajes se procesan **de uno en uno** (cola), porque los archivos temporales tienen nombre fijo (`temp/video_in.mp4`, `temp/sticker_out.webp`).
- Los videos se recortan a un máximo de 8 s para cumplir el límite de 500 KB.
- Los álbumes de fotos de TikTok no están soportados.
- TikWM tiene límite de peticiones; si falla, el bot responde con un mensaje de error.
- Si aparece `LOGOUT` + `EBUSY` en Windows: cierra los procesos de Chrome/Node, borra `.wwebjs_auth/` y vuelve a escanear el QR.

## Licencia

ISC
