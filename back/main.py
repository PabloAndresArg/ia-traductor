from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from transformers import pipeline
import soundfile as sf
import re
import os
from pathlib import Path
import numpy as np

def convert_entities(entities):
    def convert_value(val):
        if isinstance(val, np.generic):
            return val.item()
        if isinstance(val, dict):
            return {k: convert_value(v) for k, v in val.items()}
        if isinstance(val, list):
            return [convert_value(i) for i in val]
        return val
    return convert_value(entities)

app = FastAPI()

# Configurar CORS para permitir peticiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar modelos (se cargan de forma lazy para evitar errores al inicio)
stt_pipeline = None
ner_pipeline = None
tokenizer = None
translation_model = None
tts_pipeline = None




def load_models():
    """Carga los modelos de forma lazy"""
    global stt_pipeline, ner_pipeline, tokenizer, translation_model, tts_pipeline
    
    if stt_pipeline is None:
        print("Cargando modelo Speech-to-Text...")
        stt_pipeline = pipeline(
            task="automatic-speech-recognition",
            model="openai/whisper-small"
        )
    
    if ner_pipeline is None:
        print("Cargando modelo NER...")
        ner_pipeline = pipeline(
            "ner",
            model="mrm8488/bert-spanish-cased-finetuned-ner",
            aggregation_strategy="simple"
        )
    
    if tokenizer is None or translation_model is None:
        print("Cargando modelo de traducción...")
        from transformers import MarianTokenizer, MarianMTModel
        tokenizer = MarianTokenizer.from_pretrained("Helsinki-NLP/opus-mt-es-en")
        translation_model = MarianMTModel.from_pretrained("Helsinki-NLP/opus-mt-es-en")
    
    if tts_pipeline is None:
        print("Cargando modelo Text-to-Speech...")
        tts_pipeline = pipeline("text-to-speech", model="facebook/mms-tts-eng")
    
    print("Todos los modelos cargados correctamente")

# Crear directorio para archivos temporales
TEMP_DIR = Path("temp_audio")
TEMP_DIR.mkdir(exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Hola Mundo"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/translate-audio")
async def translate_audio(file: UploadFile = File(...)):
    """
    Endpoint que recibe un audio en español y devuelve:
    - Transcripción original
    - Entidades detectadas (NER + teléfonos)
    - Traducción al inglés
    - Audio sintetizado en inglés
    """
    try:
        
        # Guardar archivo temporal
        import time
        timestamp = int(time.time() * 1000)
        temp_input = TEMP_DIR / f"input_{timestamp}_{file.filename}"
        with open(temp_input, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 1. Speech-to-Text (Transcripción)
        import numpy as np
        audio_data, sample_rate = sf.read(str(temp_input))
        # Convertir a mono si es estéreo
        if audio_data.ndim > 1:
            audio_data = audio_data.mean(axis=1)
        # Whisper espera float32
        audio_data = audio_data.astype(np.float32)
        result = stt_pipeline({"array": audio_data, "sampling_rate": sample_rate})
        transcription = result["text"]

        # Validar que la transcripción no esté vacía ni sea solo espacios
        if not transcription or not transcription.strip():
            os.remove(temp_input)
            raise HTTPException(status_code=400, detail="No se pudo transcribir el audio o el texto está vacío.")

        # 2. NER (Extracción de entidades) (opcional)
        entidades = ner_pipeline(transcription)

        # 3. Traducción (Español a Inglés)
        input_ids = tokenizer(transcription, return_tensors="pt").input_ids
        if input_ids.shape[-1] == 0:
            os.remove(temp_input)
            raise HTTPException(status_code=400, detail="No se pudo tokenizar el texto para traducir.")
        outputs = translation_model.generate(input_ids)
        translated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # 4. Text-to-Speech (Síntesis de voz en inglés)
        synthesized_speech = tts_pipeline(translated_text)

        # Guardar audio de salida (opcional)
        output_audio_path = TEMP_DIR / f"output_{timestamp}_{file.filename}"

        sf.write(
            str(output_audio_path),
            synthesized_speech["audio"].squeeze(),
            synthesized_speech["sampling_rate"]
        )

        # Limpiar archivo de entrada
        os.remove(temp_input)

        return {
            "transcription": transcription,
            "entities": convert_entities(entidades),
            "translated_text": translated_text,
            "audio_file": str(output_audio_path.name)
        }
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error procesando audio: {str(e)}")




@app.get("/download-audio/{filename}")
async def download_audio(filename: str):
    """
    Endpoint para descargar el audio generado
    """
    file_path = TEMP_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        filename=filename
    )

load_models()