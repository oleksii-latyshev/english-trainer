import { useEffect, useRef, useState } from 'react';
import { type PcmRecorder, startPcmRecording } from './audio/recordPcm';
import './App.css';

type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

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

function App() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string>();
  const recorderRef = useRef<PcmRecorder | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);
  const startingRef = useRef(false);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      recorderRef.current?.cancel();
      recorderRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    };
  }, []);

  function clearPlayback() {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    setPlaybackUrl(undefined);
    setDurationMs(0);
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
          <span>
            {status === 'requesting' && 'Waiting for microphone permission…'}
            {status === 'recording' && `Recording · ${formatDuration(elapsedMs)}`}
            {status === 'stopping' && 'Finishing recording…'}
            {status === 'ready' && `Ready to listen · ${formatDuration(durationMs)}`}
            {(status === 'idle' || status === 'error') && 'Microphone ready when you are'}
          </span>
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
            {/* biome-ignore lint/a11y/useMediaCaption: A transcript is unavailable until local STT is implemented. */}
            <audio controls id="recording-playback" src={playbackUrl} />
          </div>
        )}
        <p className="tip">Try answering: “What was the most interesting part of your day?”</p>
      </section>
    </main>
  );
}

export default App;
