import { useState, useEffect } from 'react';
// Constantes para URLs y valores mágicos
const API_BASE_URL = 'http://localhost:8000';
const TRANSLATE_AUDIO_URL = `${API_BASE_URL}/translate-audio`;
const DOWNLOAD_AUDIO_URL = `${API_BASE_URL}/download-audio`;
const MAX_TIME = 10;
import { useAudioRecorder } from 'react-audio-voice-recorder';
import './AudioRecorder.css';


const blobToWav = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const numChannels = decoded.numberOfChannels;
  const sampleRate = decoded.sampleRate;
  const samples = decoded.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const write = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);

  let pos = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, decoded.getChannelData(ch)[i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      pos += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

// Barra de progreso
const ProgressBar = ({ recordingTime, maxTime }) => {
  const progress = (recordingTime / maxTime) * 100;
  return (
    <>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="status-text">{recordingTime}s / {maxTime}s</p>
    </>
  );
};

// Vista previa de audio
const AudioPreview = ({ audioUrl, onDownload, onSend, isLoading }) => (
  <div className="audio-preview">
    <p className="section-label">Vista previa</p>
    <audio key={audioUrl} src={audioUrl} controls />
    <div className="action-buttons">
      <button className="btn btn-download" onClick={onDownload}>
        💾 Descargar
      </button>
      <button className="btn btn-send" onClick={onSend} disabled={isLoading}>
        {isLoading ? '⏳ Traduciendo...' : '🌐 Traducir'}
      </button>
    </div>
  </div>
);

// Resultado de traducción
const TranslationResult = ({ translation }) => (
  <div className="translation-result">
    <p className="section-label">Resultado</p>
    {translation.error ? (
      <p className="error-msg" role="alert">{translation.error}</p>
    ) : (
      <div className="translation-content">
        <div className="translation-item">
          <strong>Transcripción</strong>
          <p>{translation.transcription}</p>
        </div>
        <div className="translation-item">
          <strong>Traducción</strong>
          <p className="translated-text">{translation.translated_text}</p>
        </div>
        <div className="translation-item">
          <strong>Audio traducido</strong>
          <audio
            key={translation.audio_file}
            src={`${DOWNLOAD_AUDIO_URL}/${translation.audio_file}`}
            controls
            style={{ width: '100%', marginTop: '6px' }}
          />
          <button
            className="btn btn-download"
            style={{ marginTop: '10px', width: '100%' }}
            onClick={() => window.open(`${DOWNLOAD_AUDIO_URL}/${translation.audio_file}`, '_blank')}
          >
            🔊 Descargar audio traducido
          </button>
        </div>
      </div>
    )}
  </div>
);

  const AudioRecorder = () => {
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const [translation, setTranslation] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    const {
      startRecording,
      stopRecording,
      recordingBlob,
      isRecording,
      recordingTime,
    } = useAudioRecorder({
      noiseSuppression: true,
      echoCancellation: true,
    });

    useEffect(() => {
      if (recordingTime >= MAX_TIME && isRecording) stopRecording();
    }, [recordingTime, isRecording]);

    useEffect(() => {
      if (!recordingBlob) return;
      setIsConverting(true);
      blobToWav(recordingBlob).then((wav) => {
        setAudioUrl(URL.createObjectURL(wav));
        setAudioBlob(wav);
        setTranslation(null);
        setIsConverting(false);
      });
    }, [recordingBlob]);

    const handleMicClick = () => {
      if (isRecording) {
        stopRecording();
      } else {
        setAudioUrl(null);
        setAudioBlob(null);
        setTranslation(null);
        startRecording();
      }
    };

    const sendToBackend = async () => {
      if (!audioBlob) return;
      setIsLoading(true);
      setTranslation(null);
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');
        const response = await fetch(TRANSLATE_AUDIO_URL, {
          method: 'POST',
          body: formData,
        });
        if (response.ok) {
          setTranslation(await response.json());
        } else {
          const err = await response.json().catch(() => null);
          setTranslation({ error: err?.detail ?? `Error ${response.status}` });
        }
      } catch {
        setTranslation({ error: 'No se pudo conectar con el servidor' });
      } finally {
        setIsLoading(false);
      }
    };

    const downloadAudio = () => {
      if (!audioUrl) return;
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'recording.wav';
      a.click();
    };

    return (
      <div className="recorder-card">
        {/* Mic button */}
        <div className="mic-wrapper">
          <button
            className={`mic-btn ${isRecording ? 'mic-btn--recording' : ''}`}
            onClick={handleMicClick}
            aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
          >
            {isRecording ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 18.93V22h2v-2.07A8.001 8.001 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z"/>
              </svg>
            )}
          </button>
          {isRecording && <div className="mic-ripple" />}
        </div>

        {/* Status */}
        <div className="recorder-status">
          {isRecording && <ProgressBar recordingTime={recordingTime} maxTime={MAX_TIME} />}
          {isConverting && <p className="status-text">Procesando audio...</p>}
          {!isRecording && !isConverting && !audioUrl && (
            <p className="status-hint">Toca el micrófono para grabar</p>
          )}
        </div>

        {/* Preview */}
        {audioUrl && !isRecording && (
          <AudioPreview
            audioUrl={audioUrl}
            onDownload={downloadAudio}
            onSend={sendToBackend}
            isLoading={isLoading}
          />
        )}

        {/* Result */}
        {translation && <TranslationResult translation={translation} />}
      </div>
    );
  };

export default AudioRecorder;
