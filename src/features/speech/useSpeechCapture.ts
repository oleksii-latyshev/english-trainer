import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type PcmRecorder, startPcmRecording } from '@/audio/recordPcm';
import type { ActualAudioInput } from '@/audio/types';
import { type CaptureState, type Recording, viewFor } from './captureView';
import { microphoneError } from './microphoneError';
import type { SpeechTiming } from './TimingPanel';
import { transcribeWav } from './transcribeWav';
import { transcriptionRecovery } from './transcriptionRecovery';
import type { useSystemSpeech } from './useSystemSpeech';

export type { CaptureView, RecordingStatus } from './captureView';

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
      // Cleanup errors cannot be shown after unmount; no data is persisted.
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
      const actualInput = recorder.actualInput;
      const startedAt = performance.now();
      timerRef.current = setInterval(() => {
        setState((current) =>
          current.tag === 'recording'
            ? { ...current, elapsedMs: performance.now() - startedAt }
            : current,
        );
      }, 100);
      setState({ tag: 'recording', elapsedMs: 0, actualInput });
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
    const actualInput = state.actualInput;
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setState({ tag: 'stopping', elapsedMs: state.elapsedMs, actualInput });
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
          actualInput,
          failure: {
            kind: 'setup',
            message: 'Open the desktop app with bun run dev to use local transcription.',
          },
        });
        return;
      }

      await runTranscription(requestId, recording, result.wav, actualInput);
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setState({ tag: 'error', message: microphoneError(cause), actualInput });
      }
    }
  }

  async function runTranscription(
    requestId: number,
    recording: Recording,
    wav: Blob,
    actualInput?: ActualAudioInput,
  ) {
    transcribingRef.current = true;
    setState({
      tag: 'transcribing',
      playbackUrl: recording.playbackUrl,
      durationMs: recording.durationMs,
      speechStoppedAtMs: recording.speechStoppedAtMs,
      actualInput,
    });
    try {
      const { text, sttMs } = await transcribeWav(wav);
      handleTranscript(requestId, recording, text, sttMs, actualInput);
    } catch (cause) {
      handleTranscriptionError(requestId, recording, cause, actualInput);
    } finally {
      transcribingRef.current = false;
    }
  }

  function handleTranscript(
    requestId: number,
    recording: Recording,
    text: string,
    sttMs: number,
    actualInput?: ActualAudioInput,
  ) {
    if (requestId !== requestIdRef.current) return;
    setTiming((current) => ({ ...current, sttMs }));
    if (!text.trim()) {
      discardRecording();
      setState({
        tag: 'error',
        message: '',
        actualInput,
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
      actualInput,
    });
  }

  function handleTranscriptionError(
    requestId: number,
    recording: Recording,
    cause: unknown,
    actualInput?: ActualAudioInput,
  ) {
    if (requestId !== requestIdRef.current) return;
    const failure = transcriptionRecovery(cause);
    if (failure.kind === 'record_again') {
      discardRecording();
      setState({ tag: 'error', message: '', failure, actualInput });
    } else {
      setState({ ...recording, tag: 'ready', failure, actualInput });
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
    await runTranscription(requestIdRef.current, state, recordedWavRef.current, state.actualInput);
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
