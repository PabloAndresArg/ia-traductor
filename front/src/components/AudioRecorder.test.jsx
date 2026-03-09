import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { createWavBlob } from './AudioRecorder';
import AudioRecorder from './AudioRecorder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Synchronously convert a Blob to an ArrayBuffer (jsdom supports this). */
function blobToArrayBuffer(blob) {
  // In jsdom, Blob.arrayBuffer() is async; use FileReaderSync-like approach via
  // the synchronous constructor path. We use the internal buffer trick:
  // Blob in jsdom stores data as Uint8Array internally.
  // Simplest: build ArrayBuffer from the blob's bytes via Response (not available).
  // Use the fact that jsdom Blob can be read via arrayBuffer() — but we need sync.
  // We'll use a workaround: create a Uint8Array from the blob text bytes.
  // Actually the cleanest approach for tests: use the blob's internal _buffer.
  // jsdom Blob stores chunks; let's just use the async path with a helper.
  throw new Error('Use blobToArrayBufferAsync instead');
}

async function blobToArrayBufferAsync(blob) {
  return blob.arrayBuffer();
}

function readString(view, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i));
  }
  return str;
}

// ---------------------------------------------------------------------------
// Unit tests — createWavBlob
// ---------------------------------------------------------------------------

describe('createWavBlob — unit tests', () => {
  it('produces a Blob of type audio/wav', async () => {
    const chunks = [new Float32Array([0.1, -0.1, 0.5])];
    const blob = createWavBlob(chunks, 44100);
    expect(blob.type).toBe('audio/wav');
  });

  it('has correct total size: 44 header bytes + 2 bytes per sample', async () => {
    const samples = [0.1, -0.2, 0.3, -0.4];
    const chunks = [new Float32Array(samples)];
    const blob = createWavBlob(chunks, 44100);
    expect(blob.size).toBe(44 + samples.length * 2);
  });

  it('writes RIFF/WAVE markers and PCM format fields correctly', async () => {
    const chunks = [new Float32Array([0, 0.5, -0.5])];
    const blob = createWavBlob(chunks, 44100);
    const buffer = await blobToArrayBufferAsync(blob);
    const view = new DataView(buffer);

    expect(readString(view, 0, 4)).toBe('RIFF');
    expect(readString(view, 8, 4)).toBe('WAVE');
    expect(readString(view, 12, 4)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1);   // PCM
    expect(view.getUint16(22, true)).toBe(1);   // mono
    expect(view.getUint32(24, true)).toBe(44100); // sampleRate
    expect(view.getUint16(34, true)).toBe(16);  // 16-bit
    expect(readString(view, 36, 4)).toBe('data');
  });

  it('handles multiple chunks concatenated correctly', async () => {
    const chunk1 = new Float32Array([0.1, 0.2]);
    const chunk2 = new Float32Array([0.3, 0.4, 0.5]);
    const blob = createWavBlob([chunk1, chunk2], 44100);
    expect(blob.size).toBe(44 + 5 * 2);
  });
});

// ---------------------------------------------------------------------------
// Property 1 — WAV header invariants
// Feature: audio-recording, Property 1: WAV header invariants
// Validates: Requirements 2.6, 5.3, 7.1, 7.2
// ---------------------------------------------------------------------------

describe('Property 1 — WAV header invariants', () => {
  it('holds for any chunks and valid sample rate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.float32Array({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        fc.constantFrom(44100, 22050, 16000),
        async (chunks, sampleRate) => {
          const blob = createWavBlob(chunks, sampleRate);
          const buffer = await blobToArrayBufferAsync(blob);
          const view = new DataView(buffer);

          expect(readString(view, 0, 4)).toBe('RIFF');
          expect(readString(view, 8, 4)).toBe('WAVE');
          expect(view.getUint16(20, true)).toBe(1);   // PCM
          expect(view.getUint16(22, true)).toBe(1);   // mono
          expect(view.getUint16(34, true)).toBe(16);  // 16-bit
          expect(view.getUint32(24, true)).toBe(sampleRate);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — WAV serialization round-trip
// Feature: audio-recording, Property 2: WAV serialization round-trip
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('Property 2 — WAV serialization round-trip', () => {
  it('Subchunk2Size equals totalSamples*2 and blob.size equals 44+totalSamples*2', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.float32Array({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        async (chunks) => {
          const totalSamples = chunks.reduce((acc, c) => acc + c.length, 0);
          const blob = createWavBlob(chunks, 44100);
          const buffer = await blobToArrayBufferAsync(blob);
          const view = new DataView(buffer);

          expect(view.getUint32(40, true)).toBe(totalSamples * 2);
          expect(blob.size).toBe(44 + totalSamples * 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — permissions / error handling (tasks 3.1 & 3.2)
// ---------------------------------------------------------------------------

describe('AudioRecorder — permission and browser compatibility errors', () => {
  let originalMediaDevices;

  beforeEach(() => {
    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  });

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      // restore to undefined
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });
    }
    vi.restoreAllMocks();
  });

  it('shows incompatibility message when navigator.mediaDevices is undefined', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<AudioRecorder />);
    const btn = screen.getByRole('button', { name: /iniciar/i });
    await userEvent.click(btn);

    expect(
      await screen.findByText(/no soporta grabación de audio/i)
    ).toBeInTheDocument();
  });

  it('shows permission denied message on NotAllowedError', async () => {
    const error = new DOMException('Permission denied', 'NotAllowedError');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(error) },
      writable: true,
      configurable: true,
    });

    render(<AudioRecorder />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar/i }));

    expect(
      await screen.findByText(/permiso de micrófono denegado/i)
    ).toBeInTheDocument();
  });

  it('shows no microphone message on NotFoundError', async () => {
    const error = new DOMException('Not found', 'NotFoundError');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(error) },
      writable: true,
      configurable: true,
    });

    render(<AudioRecorder />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar/i }));

    expect(
      await screen.findByText(/no se encontró ningún micrófono/i)
    ).toBeInTheDocument();
  });

  it('shows generic error message for other getUserMedia errors', async () => {
    const error = new Error('Some other error');
    error.name = 'AbortError';
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(error) },
      writable: true,
      configurable: true,
    });

    render(<AudioRecorder />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar/i }));

    expect(
      await screen.findByText(/error al acceder al micrófono/i)
    ).toBeInTheDocument();
  });

  it('renders error with role="alert"', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<AudioRecorder />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('shows only the record button in idle state (no alert initially)', () => {
    render(<AudioRecorder />);
    expect(screen.getByRole('button', { name: /iniciar/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Shared helper for tasks 8.1 and 8.2
// ---------------------------------------------------------------------------

function makeMocks() {
  const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
  const mockProcessor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
  const mockSource = { connect: vi.fn() };
  const mockAudioContext = {
    state: 'running',
    resume: vi.fn(),
    createMediaStreamSource: vi.fn(() => mockSource),
    createScriptProcessor: vi.fn(() => mockProcessor),
    destination: {},
    close: vi.fn(),
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    writable: true,
    configurable: true,
  });

  // Must use a real constructor function (not arrow) so `new AudioContext()` works
  vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function () {
    return mockAudioContext;
  }));

  return { mockStream, mockProcessor, mockSource, mockAudioContext };
}

async function renderStopped() {
  const { mockProcessor } = makeMocks();
  const utils = render(<AudioRecorder />);

  await userEvent.click(screen.getByRole('button', { name: /iniciar/i }));

  if (mockProcessor.onaudioprocess) {
    mockProcessor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.1, 0.2, 0.3]) } });
  }

  await userEvent.click(await screen.findByRole('button', { name: /detener/i }));
  return utils;
}

// ---------------------------------------------------------------------------
// Unit tests — sendToBackend error handling (task 8.1)
// ---------------------------------------------------------------------------

describe('AudioRecorder — sendToBackend error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows network error message when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    await renderStopped();

    await userEvent.click(await screen.findByRole('button', { name: /traducir/i }));

    expect(await screen.findByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
  });

  it('shows server error with detail when response.ok is false and json has detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: vi.fn().mockResolvedValue({ detail: 'Formato de audio no soportado' }),
    }));
    await renderStopped();

    await userEvent.click(await screen.findByRole('button', { name: /traducir/i }));

    expect(await screen.findByText(/formato de audio no soportado/i)).toBeInTheDocument();
  });

  it('shows generic server error when response.ok is false and json fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    }));
    await renderStopped();

    await userEvent.click(await screen.findByRole('button', { name: /traducir/i }));

    expect(await screen.findByText(/error del servidor: 500/i)).toBeInTheDocument();
  });

  it('shows error with role="alert" on backend error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    await renderStopped();

    await userEvent.click(await screen.findByRole('button', { name: /traducir/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/no se pudo conectar/i);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — translation result display (task 8.2)
// ---------------------------------------------------------------------------

describe('AudioRecorder — translation result display', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderWithSuccessfulTranslation(transcription, translated_text) {
    const { mockProcessor } = makeMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ transcription, translated_text }),
    }));

    render(<AudioRecorder />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar/i }));

    if (mockProcessor.onaudioprocess) {
      mockProcessor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.1, 0.2, 0.3]) } });
    }

    await userEvent.click(await screen.findByRole('button', { name: /detener/i }));
    await userEvent.click(await screen.findByRole('button', { name: /traducir/i }));
  }

  it('displays transcription and translated_text on successful response', async () => {
    await renderWithSuccessfulTranslation('Hola mundo', 'Hello world');

    expect(await screen.findByText('Hola mundo')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('does not show error alert on successful response', async () => {
    await renderWithSuccessfulTranslation('Test audio', 'Test audio translated');

    await screen.findByText('Test audio');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Unit tests — downloadWav (task 10.1)
// ---------------------------------------------------------------------------

describe('AudioRecorder — downloadWav', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates an <a> element with download="recording.wav", sets href to object URL, and clicks it', async () => {
    const fakeUrl = 'blob:http://localhost/fake-url';
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue(fakeUrl),
      revokeObjectURL: vi.fn(),
    });

    const mockAnchor = { href: '', download: '', click: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockAnchor;
      return document.createElement.wrappedMethod
        ? document.createElement.wrappedMethod(tag)
        : Object.getPrototypeOf(document).createElement.call(document, tag);
    });

    await renderStopped();

    await userEvent.click(await screen.findByRole('button', { name: /descargar/i }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockAnchor.href).toBe(fakeUrl);
    expect(mockAnchor.download).toBe('recording.wav');
    expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl);

    createElementSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Property 8 — Translation result display
// Feature: audio-recording, Property 8: Translation result display
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------

describe('Property 8 — Translation result display', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('always displays both transcription and translated_text for any string values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          transcription: fc.string({ minLength: 1, maxLength: 50 }),
          translated_text: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ transcription, translated_text }) => {
          const { mockProcessor } = makeMocks();
          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ transcription, translated_text }),
          }));

          const { container, unmount } = render(<AudioRecorder />);
          const scope = within(container);

          await userEvent.click(scope.getByRole('button', { name: /iniciar/i }));

          if (mockProcessor.onaudioprocess) {
            mockProcessor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.1, 0.2]) } });
          }

          await userEvent.click(await scope.findByRole('button', { name: /detener/i }));
          await userEvent.click(await scope.findByRole('button', { name: /traducir/i }));

          expect(await scope.findByText(transcription)).toBeInTheDocument();
          expect(scope.getByText(translated_text)).toBeInTheDocument();

          unmount();
          vi.unstubAllGlobals();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});
