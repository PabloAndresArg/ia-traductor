# Grabador de Audio - React

Aplicación web para grabar audio de hasta 10 segundos y exportarlo en formato WAV para enviar a un backend.

## Características

- ⏺️ Grabación de audio desde el micrófono
- ⏱️ Límite de 10 segundos de grabación
- 🎵 Vista previa del audio grabado
- 💾 Descarga del audio en formato WAV
- 📤 Envío del audio al backend mediante API

## Instalación

```bash
npm install
```

## Uso

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Configuración del Backend

Para enviar el audio al backend, modifica la URL en el archivo `src/components/AudioRecorder.jsx`:

```javascript
const response = await fetch('http://localhost:3000/api/audio', {
  method: 'POST',
  body: formData,
});
```

Reemplaza `http://localhost:3000/api/audio` con la URL de tu API.

## Formato del Audio

El audio se envía en formato WAV con las siguientes características:
- Formato: PCM sin comprimir
- Bits por muestra: 16-bit
- Canales: Mono o Estéreo (según el micrófono)
- Nombre del archivo: `recording.wav`

## Permisos

La aplicación requiere permisos de acceso al micrófono. El navegador solicitará estos permisos la primera vez que intentes grabar.

## Tecnologías

- React + Vite
- MediaRecorder API
- Web Audio API
- FormData API
