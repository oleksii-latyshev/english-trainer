import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type PcmRecorder, startPcmRecording } from '@/audio/recordPcm';
import { microphoneError } from './microphoneError';
import type { SpeechTiming } from './TimingPanel';
import { transcribeWav } from './transcribeWav';
import { type TranscriptionRecovery, transcriptionRecovery } from './transcriptionRecovery';
import type { useSystemSpeech } from './useSystemSpeech';

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

type Recording = { playbackUrl: string; durationMs: number; speechStoppedAtMs: number };

type CaptureState =
  | { tag: 'idle' | 'requesting' }
  | { tag: 'recording' | 'stopping'; elapsedMs: number }
  | ({ tag: 'ready'; failure?: TranscriptionRecovery } & Recording)
  | ({ tag: 'transcribing' } & Recording)
  | { tag: 'transcript'; text: string; durationMs: number; speechStoppedAtMs: number }
  | { tag: 'error'; message: string; failure?: TranscriptionRecovery };

export type CaptureView = {
  status: RecordingStatus;
  error: string;
  elapsedMs: number;
  durationMs: number;
  playbackUrl?: string;
  transcript?: string;
  transcriptionFailure?: TranscriptionRecovery;
  transcribing: boolean;
  timing: SpeechTiming;
  currentRequestId: number;
  speechStoppedAtMs?: number;
};

function recordingStatus(state: CaptureState): RecordingStatus {
  if (state.tag === 'transcribing' || state.tag === 'transcript') return 'ready';
  return state.tag;
}

function viewFor(state: CaptureState, timing: SpeechTiming, currentRequestId: number): CaptureView {
  return {
    status: recordingStatus(state),
    error: state.tag === 'error' && !state.failure ? state.message : '',
    elapsedMs: state.tag === 'recording' || state.tag === 'stopping' ? state.elapsedMs : 0,
    durationMs:
      state.tag === 'ready' || state.tag === 'transcribing' || state.tag === 'transcript'
        ? state.durationMs
        : 0,
    playbackUrl:
      state.tag === 'ready' || state.tag === 'transcribing' ? state.playbackUrl : undefined,
    transcript: state.tag === 'transcript' ? state.text : undefined,
    transcriptionFailure:
      state.tag === 'ready' || state.tag === 'error' ? state.failure : undefined,
    transcribing: state.tag === 'transcribing',
    timing,
    currentRequestId,
    speechStoppedAtMs: state.tag === 'transcript' ? state.speechStoppedAtMs : undefined,
  };
}

export function useSpeechCapture(speech: ReturnType<typeof useSystemSpeech>) {
  const [state, setState] = useState<CaptureState>({ tag: 'idle' });
  const [timing, setTiming] = useState<SpeechTiming>({});
  const recorderRef = useRef<PcmRecorder | null>(null);
  const recordedWavRef = useRef<Blob | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);
  const startingRef = useRef(false);
  const transcribingRef = useRef(false);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      // Cleanup errors cannot be shown after unmount and do not affect saved data.
      void recorderRef.current?.cancel().catch(() => {});
      recorderRef.current = null;
      recordedWavRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    };
  }, []);

  function discardRecording() {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    recordedWavRef.current = null;
  }

  function reset() {
    requestIdRef.current += 1;
    discardRecording();
    transcribingRef.current = false;
    setTiming({});
    setState({ tag: 'idle' });
  }

  function deviceLost() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const requestId = requestIdRef.current;
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    void recorder.cancel().catch((cause) => {
      if (requestId === requestIdRef.current) {
        setState({ tag: 'error', message: microphoneError(cause) });
      }
    });
    setState({
      tag: 'error',
      message: 'The microphone disconnected during recording. Reconnect it and try again.',
    });
  }

  async function startRecording() {
    if (
      startingRef.current ||
      recorderRef.current ||
      state.tag === 'requesting' ||
      state.tag === 'stopping' ||
      state.tag === 'transcribing'
    )
      return;
    startingRef.current = true;
    const requestId = ++requestIdRef.current;
    speech.stop();
    discardRecording();
    setTiming({});
    setState({ tag: 'requesting' });
    try {
      const recorder = await startPcmRecording(deviceLost);
      if (requestId !== requestIdRef.current) {
        await recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
      const startedAt = performance.now();
      timerRef.current = setInterval(() => {
        setState((current) =>
          current.tag === 'recording'
            ? { tag: 'recording', elapsedMs: performance.now() - startedAt }
            : current,
        );
      }, 100);
      setState({ tag: 'recording', elapsedMs: 0 });
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setState({ tag: 'error', message: microphoneError(cause) });
      }
    } finally {
      startingRef.current = false;
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || state.tag !== 'recording') return;
    const requestId = requestIdRef.current;
    const speechStoppedAtMs = performance.now();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setState({ tag: 'stopping', elapsedMs: state.elapsedMs });
    try {
      const startedAt = performance.now();
      const result = await recorder.stop();
      if (requestId !== requestIdRef.current) return;
      setTiming((current) => ({
        ...current,
        captureFinalizationMs: performance.now() - startedAt,
      }));
      const playbackUrl = URL.createObjectURL(result.wav);
      recordedWavRef.current = result.wav;
      playbackUrlRef.current = playbackUrl;
      const recording: Recording = {
        playbackUrl,
        durationMs: result.durationMs,
        speechStoppedAtMs,
      };

      if (!isTauri()) {
        setState({
          ...recording,
          tag: 'ready',
          failure: {
            kind: 'setup',
            message: 'Open the desktop app with bun run dev to use local transcription.',
          },
        });
        return;
      }

      await runTranscription(requestId, recording, result.wav);
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setState({ tag: 'error', message: microphoneError(cause) });
      }
    }
  }

  async function runTranscription(requestId: number, recording: Recording, wav: Blob) {
    transcribingRef.current = true;
    setState({
      tag: 'transcribing',
      playbackUrl: recording.playbackUrl,
      durationMs: recording.durationMs,
      speechStoppedAtMs: recording.speechStoppedAtMs,
    });
    try {
      const { text, sttMs } = await transcribeWav(wav);
      handleTranscript(requestId, recording, text, sttMs);
    } catch (cause) {
      handleTranscriptionError(requestId, recording, cause);
    } finally {
      transcribingRef.current = false;
    }
  }

  function handleTranscript(requestId: number, recording: Recording, text: string, sttMs: number) {
    if (requestId !== requestIdRef.current) return;
    setTiming((current) => ({ ...current, sttMs }));
    if (!text.trim()) {
      discardRecording();
      setState({
        tag: 'error',
        message: '',
        failure: {
          kind: 'record_again',
          message: 'No speech was detected. Try speaking closer to the microphone.',
        },
      });
      return;
    }
    discardRecording();
    setState({
      tag: 'transcript',
      text,
      durationMs: recording.durationMs,
      speechStoppedAtMs: recording.speechStoppedAtMs,
    });
  }

  function handleTranscriptionError(requestId: number, recording: Recording, cause: unknown) {
    if (requestId !== requestIdRef.current) return;
    const failure = transcriptionRecovery(cause);
    if (failure.kind === 'record_again') {
      discardRecording();
      setState({ tag: 'error', message: '', failure });
    } else {
      setState({ ...recording, tag: 'ready', failure });
    }
  }

  async function transcribeRecording() {
    if (state.tag !== 'ready' || transcribingRef.current || !recordedWavRef.current) return;
    if (!isTauri()) {
      setState({
        ...state,
        failure: {
          kind: 'setup',
          message: 'Open the desktop app with bun run dev to use local transcription.',
        },
      });
      return;
    }
    await runTranscription(requestIdRef.current, state, recordedWavRef.current);
  }

  const view = viewFor(state, timing, requestIdRef.current);
  const canChangeSession =
    !startingRef.current &&
    !transcribingRef.current &&
    state.tag !== 'requesting' &&
    state.tag !== 'recording' &&
    state.tag !== 'stopping' &&
    state.tag !== 'transcribing';

  return {
    view,
    canChangeSession,
    reset,
    startRecording,
    stopRecording,
    transcribeRecording,
    isCurrentRequest: (requestId: number) => requestId === requestIdRef.current,
  };
}
