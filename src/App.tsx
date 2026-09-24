import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type PcmRecorder, startPcmRecording } from './audio/recordPcm';
import './App.css';

type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';
type Transcript = { text: string; language: string; duration_ms: number };

function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function microphoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone access was denied. Allow access in macOS System Settings → Privacy & Security → Microphone, then try again.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No microphone was found. Connect one and try again.';
    }
    if (error.name === 'NotReadableError') {
      return 'The microphone is busy or unavailable. Close other apps using it and try again.';
    }
  }
  return error instanceof Error ? error.message : 'Recording failed. Please try again.';
}

function transcriptionErrorMessage(cause: unknown): string {
  if (typeof cause === 'string') return cause;
  if (cause instanceof Error) return cause.message;
  return 'Transcription failed. Please try again.';
}

function recordingLabel(status: RecordingStatus, elapsedMs: number, durationMs: number): string {
  switch (status) {
    case 'requesting':
      return 'Waiting for microphone permission…';
    case 'recording':
      return `Recording · ${formatDuration(elapsedMs)}`;
    case 'stopping':
      return 'Finishing recording…';
    case 'ready':
      return `Ready to listen · ${formatDuration(durationMs)}`;
    default:
      return 'Microphone ready when you are';
  }
}

function transcribeButtonLabel(transcribing: boolean, transcript: string | undefined): string {
  if (transcribing) return 'Transcribing locally…';
  return transcript ? 'Transcribe again' : 'Transcribe';
}

function App() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string>();
  const [transcript, setTranscript] = useState<string>();
  const [transcriptionError, setTranscriptionError] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const recordedWavRef = useRef<Blob | null>(null);
  const transcribingRef = useRef(false);
  const playbackUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);
  const startingRef = useRef(false);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      recorderRef.current?.cancel();
      recorderRef.current = null;
      recordedWavRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    };
  }, []);

  function clearPlayback() {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    setPlaybackUrl(undefined);
    setDurationMs(0);
    recordedWavRef.current = null;
    setTranscript(undefined);
    setTranscriptionError('');
    transcribingRef.current = false;
    setTranscribing(false);
  }

  function deviceLost() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    void recorder.cancel();
    setError('The microphone disconnected during recording. Reconnect it and try again.');
    setStatus('error');
  }

  async function startRecording() {
    if (startingRef.current || recorderRef.current) return;
    startingRef.current = true;
    const requestId = ++requestIdRef.current;
    clearPlayback();
    setElapsedMs(0);
    setError('');
    setStatus('requesting');

    try {
      const recorder = await startPcmRecording(deviceLost);
      if (requestId !== requestIdRef.current) {
        await recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
      const startedAt = performance.now();
      timerRef.current = setInterval(() => setElapsedMs(performance.now() - startedAt), 100);
      setStatus('recording');
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(microphoneError(cause));
        setStatus('error');
      }
    } finally {
      startingRef.current = false;
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const requestId = requestIdRef.current;
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStatus('stopping');
    try {
      const result = await recorder.stop();
      if (requestId !== requestIdRef.current) return;
      const url = URL.createObjectURL(result.wav);
      recordedWavRef.current = result.wav;
      playbackUrlRef.current = url;
      setPlaybackUrl(url);
      setDurationMs(result.durationMs);
      setStatus('ready');
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(microphoneError(cause));
        setStatus('error');
      }
    }
  }

  async function transcribeRecording() {
    const wav = recordedWavRef.current;
    if (!wav || transcribingRef.current) return;
    if (!isTauri()) {
      setTranscriptionError('Open the desktop app with bun run dev to use local transcription.');
      return;
    }
    const requestId = requestIdRef.current;
    transcribingRef.current = true;
    setTranscribing(true);
    setTranscriptionError('');
    try {
      const audioBytes = new Uint8Array(await wav.arrayBuffer());
      const result = await invoke<Transcript>('transcribe_audio', audioBytes);
      if (requestId === requestIdRef.current) setTranscript(result.text);
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setTranscriptionError(transcriptionErrorMessage(cause));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        transcribingRef.current = false;
        setTranscribing(false);
      }
    }
  }

  const busy = status === 'requesting' || status === 'stopping';

  return (
    <main className="app-shell">
      <section className="practice-card" aria-labelledby="practice-title">
        <p className="eyebrow">English Trainer · Audio check</p>
        <h1 id="practice-title">Speak a little English</h1>
        <p className="intro">
          Record a short answer and listen back. Your audio stays in this window and is discarded
          when you record again or close the app.
        </p>

        <div className={`recorder-state recorder-state--${status}`} aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>{recordingLabel(status, elapsedMs, durationMs)}</span>
        </div>

        <div className="controls">
          {status === 'recording' ? (
            <button
              className="record-button record-button--stop"
              onClick={stopRecording}
              type="button"
            >
              <span className="stop-icon" aria-hidden="true" />
              Stop recording
            </button>
          ) : (
            <button
              className="record-button"
              disabled={busy}
              onClick={startRecording}
              type="button"
            >
              <span className="record-icon" aria-hidden="true" />
              {status === 'ready' ? 'Record again' : 'Start recording'}
            </button>
          )}
        </div>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {playbackUrl && (
          <div className="playback">
            <label htmlFor="recording-playback">Your recording</label>
            {/* biome-ignore lint/a11y/useMediaCaption: The transcript is shown below; timed captions are not available yet. */}
            <audio controls id="recording-playback" src={playbackUrl} />
            <button
              className="transcribe-button"
              disabled={transcribing}
              onClick={transcribeRecording}
              type="button"
            >
              {transcribeButtonLabel(transcribing, transcript)}
            </button>
            {transcriptionError && (
              <p className="error-message" role="alert">
                {transcriptionError}
              </p>
            )}
            {transcript && (
              <div className="transcript" aria-live="polite">
                <h2>Transcript</h2>
                <p>{transcript}</p>
              </div>
            )}
          </div>
        )}
        <p className="tip">Try answering: “What was the most interesting part of your day?”</p>
      </section>
    </main>
  );
}

export default App;
