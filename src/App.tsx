import { Button, Card } from '@heroui/react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type PcmRecorder, startPcmRecording } from '@/audio/recordPcm';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { type SpeechTiming, TimingPanel } from '@/features/speech/TimingPanel';
import {
  type TranscriptionRecovery,
  transcriptionRecovery,
} from '@/features/speech/transcriptionRecovery';
import { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { isTranscript } from '@/lib/types';
import './App.css';

type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

async function transcribeWav(wav: Blob): Promise<{ text: string; sttMs: number }> {
  const audioBytes = new Uint8Array(await wav.arrayBuffer());
  const startedAt = performance.now();
  const result = await invoke<unknown>('transcribe_audio', audioBytes);
  if (!isTranscript(result))
    throw new Error('The transcription response had an unexpected format.');
  return { text: result.text, sttMs: performance.now() - startedAt };
}

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
    case 'error':
      return 'Ready to try again';
    default:
      return 'Microphone ready when you are';
  }
}

function transcribeButtonLabel(
  transcribing: boolean,
  failure: TranscriptionRecovery | undefined,
): string {
  if (transcribing) return 'Transcribing locally…';
  if (failure?.kind === 'setup') return 'Retry after setup';
  return failure ? 'Retry transcription' : 'Transcribe';
}

function recordButtonLabel(status: RecordingStatus, hasTranscript: boolean): string {
  if (status === 'error') return 'Try recording again';
  if (status === 'ready' || hasTranscript) return 'Record again';
  return 'Start recording';
}

function App() {
  const speech = useSystemSpeech();
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string>();
  const [transcript, setTranscript] = useState<string>();
  const [transcriptionFailure, setTranscriptionFailure] = useState<TranscriptionRecovery>();
  const [transcribing, setTranscribing] = useState(false);
  const [timing, setTiming] = useState<SpeechTiming>({});
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

  function discardRecording() {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    setPlaybackUrl(undefined);
    recordedWavRef.current = null;
  }

  function clearPlayback() {
    discardRecording();
    setDurationMs(0);
    setTranscript(undefined);
    setTranscriptionFailure(undefined);
    transcribingRef.current = false;
    setTranscribing(false);
  }

  function deviceLost() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const requestId = requestIdRef.current;
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    void recorder.cancel().catch((cause) => {
      if (requestId === requestIdRef.current) setError(microphoneError(cause));
    });
    setError('The microphone disconnected during recording. Reconnect it and try again.');
    setStatus('error');
  }

  async function startRecording() {
    if (startingRef.current || recorderRef.current) return;
    startingRef.current = true;
    const requestId = ++requestIdRef.current;
    speech.stop();
    clearPlayback();
    setTiming({});
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
      const startedAt = performance.now();
      const result = await recorder.stop();
      if (requestId !== requestIdRef.current) return;
      setTiming((current) => ({
        ...current,
        captureFinalizationMs: performance.now() - startedAt,
      }));
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

  function finishTranscription(requestId: number) {
    if (requestId !== requestIdRef.current) return;
    transcribingRef.current = false;
    setTranscribing(false);
  }

  function handleTranscript(requestId: number, text: string, sttMs: number) {
    if (requestId !== requestIdRef.current) return;
    setTiming((current) => ({ ...current, sttMs }));
    if (!text.trim()) {
      setTranscriptionFailure({
        kind: 'record_again',
        message: 'No speech was detected. Try speaking closer to the microphone.',
      });
      discardRecording();
      setStatus('error');
      return;
    }
    setTranscript(text);
    discardRecording();
    speech.play(text, (ttsStartMs) => {
      if (requestId === requestIdRef.current) setTiming((current) => ({ ...current, ttsStartMs }));
    });
  }

  function handleTranscriptionFailure(requestId: number, cause: unknown) {
    if (requestId !== requestIdRef.current) return;
    const failure = transcriptionRecovery(cause);
    setTranscriptionFailure(failure);
    if (failure.kind === 'record_again') {
      discardRecording();
      setStatus('error');
    }
  }

  async function transcribeRecording() {
    const wav = recordedWavRef.current;
    if (!wav || transcribingRef.current) return;
    if (!isTauri()) {
      setTranscriptionFailure({
        kind: 'setup',
        message: 'Open the desktop app with bun run dev to use local transcription.',
      });
      return;
    }
    const requestId = requestIdRef.current;
    transcribingRef.current = true;
    setTranscribing(true);
    setTranscriptionFailure(undefined);
    try {
      const { text, sttMs } = await transcribeWav(wav);
      handleTranscript(requestId, text, sttMs);
    } catch (cause) {
      handleTranscriptionFailure(requestId, cause);
    } finally {
      finishTranscription(requestId);
    }
  }

  const busy = status === 'requesting' || status === 'stopping';

  return (
    <main className="app-shell min-h-screen text-slate-100">
      <div className="app-frame mx-auto w-full max-w-6xl">
        <header className="app-header flex items-center justify-between gap-4">
          <div className="brand flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true">
              ✦
            </span>
            <span>English Trainer</span>
          </div>
          <span className="header-pill">LOCAL SPEECH LAB</span>
        </header>

        <div className="content-grid grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <section aria-labelledby="practice-title" className="min-w-0">
            <p className="eyebrow">PRACTICE / SPEAKING</p>
            <h1 id="practice-title">Your voice, in English.</h1>
            <p className="intro">
              Take a moment to answer the prompt. We’ll transcribe your words locally, then read
              them back so you can hear the phrasing.
            </p>

            <Card className="panel practice-panel" variant="secondary">
              <Card.Header className="panel-header">
                <div>
                  <p className="section-kicker">TODAY’S PROMPT</p>
                  <Card.Title className="prompt-title">
                    What was the most interesting part of your day?
                  </Card.Title>
                </div>
                <span className="prompt-index">01 / 01</span>
              </Card.Header>
              <Card.Content className="panel-content">
                <div className={`recorder-state recorder-state--${status}`} aria-live="polite">
                  <div className="mic-orb" aria-hidden="true">
                    <span className="mic-symbol">●</span>
                  </div>
                  <span className="recorder-copy">
                    {recordingLabel(status, elapsedMs, durationMs)}
                  </span>
                </div>
                <div className="controls flex flex-wrap gap-3">
                  {status === 'recording' ? (
                    <Button className="primary-action" onPress={stopRecording} variant="danger">
                      Stop recording
                    </Button>
                  ) : (
                    <Button
                      className="primary-action"
                      isDisabled={busy}
                      onPress={startRecording}
                      variant="primary"
                    >
                      {recordButtonLabel(status, Boolean(transcript))}
                    </Button>
                  )}
                  {playbackUrl && (
                    <Button
                      className="secondary-action"
                      isDisabled={transcribing}
                      onPress={transcribeRecording}
                      variant="secondary"
                    >
                      {transcribeButtonLabel(transcribing, transcriptionFailure)}
                    </Button>
                  )}
                </div>
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                {transcriptionFailure && (
                  <p className="error-message" role="alert">
                    {transcriptionFailure.message}
                  </p>
                )}
                {playbackUrl && (
                  <div className="recording-preview">
                    <label htmlFor="recording-playback">
                      Review your recording before transcription
                    </label>
                    {/* biome-ignore lint/a11y/useMediaCaption: A timed caption is unavailable before transcription. */}
                    <audio controls id="recording-playback" src={playbackUrl} />
                  </div>
                )}
              </Card.Content>
            </Card>

            <Card className="panel transcript-panel" variant="secondary">
              <Card.Header className="panel-header">
                <div>
                  <p className="section-kicker">YOUR WORDS</p>
                  <Card.Title className="section-title">Transcript</Card.Title>
                </div>
                <span className={`result-indicator ${transcript ? 'result-indicator--ready' : ''}`}>
                  {transcript ? 'READY' : 'WAITING'}
                </span>
              </Card.Header>
              <Card.Content className="panel-content">
                {transcript ? (
                  <p className="transcript-text" aria-live="polite">
                    “{transcript}”
                  </p>
                ) : (
                  <p className="empty-transcript">
                    Your transcript will appear here after you record and transcribe a short answer.
                  </p>
                )}
              </Card.Content>
            </Card>
            <TimingPanel timing={timing} />
          </section>

          <SpeechPanel speech={speech} transcript={transcript} />
        </div>
      </div>
    </main>
  );
}

export default App;
