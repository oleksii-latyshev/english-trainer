import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type PcmRecorder, startPcmRecording } from '@/audio/recordPcm';
import { advancePractice } from '@/features/practice/advancePractice';
import {
  type PracticeState,
  PracticeView,
  type RecordingStatus,
} from '@/features/practice/PracticeView';
import { finishPracticeSession, startPracticeSession } from '@/features/practice/sessionApi';
import { microphoneError } from '@/features/speech/microphoneError';
import type { SpeechTiming } from '@/features/speech/TimingPanel';
import { transcribeWav } from '@/features/speech/transcribeWav';
import {
  type TranscriptionRecovery,
  transcriptionRecovery,
} from '@/features/speech/transcriptionRecovery';
import { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { type ConversationTurn, isProviderError } from '@/lib/types';
import './App.css';

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
  const [practice, setPractice] = useState<PracticeState>({ tag: 'idle' });
  const [practiceError, setPracticeError] = useState('');
  const [turnPending, setTurnPending] = useState(false);
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

  async function startPractice() {
    if (practice.tag !== 'idle' || recorderRef.current || transcribingRef.current) return;
    if (!isTauri()) {
      setPracticeError('Open the desktop app with bun run dev to start a conversation.');
      return;
    }
    setPractice({ tag: 'starting' });
    setPracticeError('');
    try {
      const result = await startPracticeSession();
      requestIdRef.current += 1;
      speech.stop();
      clearPlayback();
      setTiming({});
      setStatus('idle');
      setError('');
      setPractice({
        tag: 'active',
        sessionId: result.session_id,
        question: result.opening_question,
        turnCount: result.turn_count,
      });
      speech.play(result.opening_question);
    } catch (cause) {
      setPractice({ tag: 'idle' });
      setPracticeError(
        isProviderError(cause) ? cause.message : 'Could not start practice. Please try again.',
      );
    }
  }

  async function finishPractice() {
    if (practice.tag !== 'active' || recorderRef.current || transcribingRef.current || turnPending)
      return;
    const previous = practice;
    setPractice({ ...previous, tag: 'finishing' });
    setPracticeError('');
    try {
      await finishPracticeSession(previous.sessionId);
      requestIdRef.current += 1;
      speech.stop();
      clearPlayback();
      setTiming({});
      setStatus('idle');
      setPractice({ tag: 'idle' });
    } catch (cause) {
      setPractice(previous);
      setPracticeError(
        isProviderError(cause) ? cause.message : 'Could not finish practice. Please try again.',
      );
    }
  }

  const busy =
    status === 'requesting' ||
    status === 'stopping' ||
    practice.tag === 'starting' ||
    practice.tag === 'finishing';
  const currentRequestId = requestIdRef.current;

  return (
    <PracticeView
      model={{
        status,
        error,
        elapsedMs,
        durationMs,
        playbackUrl,
        transcript,
        transcriptionFailure,
        transcribing,
        timing,
        practice,
        practiceError,
        busy,
        turnPending,
        currentRequestId,
      }}
      actions={{
        startRecording,
        stopRecording,
        transcribeRecording,
        startPractice,
        finishPractice,
        handlePracticeTurn: (sessionId: number, turn: ConversationTurn) =>
          setPractice((current) => advancePractice(current, sessionId, turn)),
        isCurrent: () => currentRequestId === requestIdRef.current,
        onTurnPendingChange: setTurnPending,
      }}
      speech={speech}
    />
  );
}

export default App;
