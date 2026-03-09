# API FastAPI - Audio IA

API con FastAPI para transcribir, traducir y sintetizar audio de español a inglés.

## Instalación

```bash
pip install -r requirements.txt
```

## Ejecutar el servidor

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /` - Hola Mundo
- `GET /health` - Health check
- `POST /translate-audio` - Procesa audio en español y devuelve traducción + audio en inglés
- `GET /download-audio/{filename}` - Descarga el audio generado
- `GET /docs` - Documentación interactiva (Swagger UI)
- `GET /redoc` - Documentación alternativa (ReDoc)

## Flujo de procesamiento

1. **Speech-to-Text**: Transcribe el audio usando Whisper (OpenAI)
2. **NER**: Extrae entidades nombradas usando BERT español
3. **Regex**: Detecta números de teléfono
4. **Traducción**: Traduce de español a inglés usando Helsinki-NLP
5. **Text-to-Speech**: Genera audio en inglés usando Facebook MMS

## Ejemplo de uso

```bash
curl -X POST "http://localhost:8000/translate-audio" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@audio.wav"
```

## Respuesta

```json
{
  "transcription": "Hola, mi nombre es Juan",
  "entities": [
    {"tipo": "PER", "valor": "Juan"}
  ],
  "translated_text": "Hello, my name is Juan",
  "audio_file": "output_audio.wav"
}
```
