import { useEffect, useRef, useState } from 'react';
import type { MicrophoneSession } from '@/audio/microphoneSession';
import type { PcmRecorder } from '@/audio/recordPcm';
import type { MicrophoneController } from '@/audio/useMicrophoneSession';
import {
  type CaptureState,
  isCapturing,
  type Recording,
  type RecordingMode,
  stopMeansCancel,
  viewFor,
} from './captureView';
import {
  isAssistantSpeaking,
  openRecorder,
  sessionFor,
  startElapsedTimer,
  type TurnWatch,
  watchActiveTurn,
} from './listening';
import { microphoneError } from './microphoneError';
import { startOneShotLiveTranscript } from './oneShotLiveTranscript';
import { createRescueCapture } from './rescueCapture';
import type { SpeechTiming } from './TimingPanel';
import { createTranscriptionRunner } from './transcriptionRunner';
import type { useSystemSpeech } from './useSystemSpeech';

export type { CaptureView, RecordingStatus } from './captureView';

/**
 * Records and transcribes answers. With a microphone controller the recording uses its warm
 * session (instant start, pre-roll, end-of-turn detection); without one every recording opens
 * its own microphone, as the memory recall drill does.
 */
export function useSpeechCapture(
  speech: ReturnType<typeof useSystemSpeech>,
  mic?: MicrophoneController,
) {
  const [state, setState] = useState<CaptureState>({ tag: 'idle' });
  const [timing, setTiming] = useState<SpeechTiming>({});
  const recorderRef = useRef<PcmRecorder | null>(null);
  const rescueHeldRef = useRef(false);
  const recordedWavRef = useRef<Blob | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);
  const startingRef = useRef(false);
  const transcribingRef = useRef(false);
  const stateRef = useRef(state);
  const speechRef = useRef(speech);
  const micRef = useRef(mic);
  const turnWatchRef = useRef<TurnWatch | null>(null);
  const oneShotLiveRef = useRef<ReturnType<typeof startOneShotLiveTranscript> | null>(null);
  const handlersRef = useRef({ stop: () => {}, cancel: () => {} });
  stateRef.current = state;
  speechRef.current = speech;
  micRef.current = mic;

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      turnWatchRef.current?.dispose();
      oneShotLiveRef.current?.dispose();
      oneShotLiveRef.current = null;
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
    const requestId = ++requestIdRef.current;
    stopListening();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) releaseRecorder(recorder, requestId);
    discardRecording();
    transcribingRef.current = false;
    setTiming({});
    setState({ tag: 'idle' });
  }

  function clearElapsedTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopListening() {
    turnWatchRef.current?.dispose();
    turnWatchRef.current = null;
    oneShotLiveRef.current?.dispose();
    oneShotLiveRef.current = null;
    clearElapsedTimer();
  }

  /** Releases a recorder; a failure to release it is shown unless a newer request took over. */
  function releaseRecorder(recorder: PcmRecorder, requestId: number) {
    void recorder.cancel().catch((cause) => {
      if (requestId === requestIdRef.current) {
        setState({ tag: 'error', message: microphoneError(cause) });
      }
    });
  }

  function deviceLost() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    stopListening();
    releaseRecorder(recorder, requestIdRef.current);
    setState({
      tag: 'error',
      message: 'The microphone disconnected during recording. Reconnect it and try again.',
    });
  }

  function startBlocked(): boolean {
    return startingRef.current || recorderRef.current !== null || isCapturing(stateRef.current);
  }

  function enterRecording(
    recorder: PcmRecorder,
    session: MicrophoneSession | null,
    mode: RecordingMode,
    requestId: number,
    requestedAtMs: number,
  ) {
    recorderRef.current = recorder;
    rescueHeldRef.current = false;
    const startedAt = performance.now();
    setTiming({ captureStartMs: startedAt - requestedAtMs });
    if (!session) {
      oneShotLiveRef.current = startOneShotLiveTranscript(recorder, (liveText) => {
        if (requestId !== requestIdRef.current) return;
        setState((current) => (current.tag === 'recording' ? { ...current, liveText } : current));
      });
    }
    timerRef.current = startElapsedTimer(recorder, startedAt, (elapsedMs, level) => {
      oneShotLiveRef.current?.sampleLevel(level);
      setState((state) => (state.tag === 'recording' ? { ...state, elapsedMs, level } : state));
    });
    if (session) {
      turnWatchRef.current = watchActiveTurn(session, recorder, mode, {
        setState,
        onTurnEnded: () => handlersRef.current.stop(),
        onIdleTimeout: () => handlersRef.current.cancel(),
        isCurrent: () => requestId === requestIdRef.current,
      });
    }
    setState({
      tag: 'recording',
      elapsedMs: 0,
      level: 0,
      mode,
      held: false,
      heardSpeech: false,
      liveText: '',
      actualInput: recorder.actualInput,
    });
  }

  async function beginRecording(mode: RecordingMode, discardPreRoll = false) {
    if (startBlocked()) return;
    const session = sessionFor(micRef.current, mode);
    if (mode === 'auto' && !session) return;
    startingRef.current = true;
    const requestId = ++requestIdRef.current;
    const requestedAtMs = performance.now();
    const assistantWasSpeaking = discardPreRoll || isAssistantSpeaking(speechRef.current);
    speechRef.current.stop();
    discardRecording();
    setTiming({});
    setState({ tag: 'requesting' });
    try {
      const recorder = await openRecorder(session, {
        mode,
        assistantWasSpeaking,
        onDeviceLost: deviceLost,
      });
      if (requestId !== requestIdRef.current) {
        await recorder.cancel();
        return;
      }
      enterRecording(recorder, session, mode, requestId, requestedAtMs);
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
    const current = stateRef.current;
    if (!recorder || current.tag !== 'recording') return;
    if (stopMeansCancel(current.heardSpeech, turnWatchRef.current !== null))
      return cancelRecording();
    const requestId = requestIdRef.current;
    const speechStoppedAtMs = performance.now();
    const actualInput = current.actualInput;
    recorderRef.current = null;
    stopListening();
    setState({ ...current, tag: 'stopping', level: 0, held: false, liveText: '' });
    try {
      const startedAt = performance.now();
      const result = await recorder.stop();
      if (requestId !== requestIdRef.current) return;
      setTiming((timing) => ({
        ...timing,
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

      await runTranscription(requestId, recording, result.wav, actualInput);
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setState({ tag: 'error', message: microphoneError(cause), actualInput });
      }
    }
  }

  /** Abandons listening or recording without transcribing or sending anything. */
  function cancelRecording() {
    const recorder = recorderRef.current;
    const current = stateRef.current;
    if (!recorder && current.tag !== 'requesting') return;
    const requestId = ++requestIdRef.current;
    recorderRef.current = null;
    stopListening();
    setState({ tag: 'idle' });
    if (recorder) releaseRecorder(recorder, requestId);
  }

  function holdListening(held: boolean) {
    turnWatchRef.current?.setHold(held || rescueHeldRef.current);
    setState((state) => (state.tag === 'recording' ? { ...state, held } : state));
  }

  handlersRef.current = { stop: () => void stopRecording(), cancel: cancelRecording };

  const runTranscription = createTranscriptionRunner({
    requestIdRef,
    transcribingRef,
    setState,
    setTiming,
    discardRecording,
  });

  async function transcribeRecording() {
    if (state.tag !== 'ready' || transcribingRef.current || !recordedWavRef.current) return;
    await runTranscription(requestIdRef.current, state, recordedWavRef.current, state.actualInput);
  }

  const view = viewFor(
    state,
    timing,
    requestIdRef.current,
    mic ? { status: mic.status, error: mic.error } : undefined,
  );
  const canChangeSession = !startingRef.current && !transcribingRef.current && !isCapturing(state);

  return {
    ...createRescueCapture({
      recorder: recorderRef,
      state: stateRef,
      requestId: requestIdRef,
      turnWatch: turnWatchRef,
      held: rescueHeldRef,
    }),
    view,
    canChangeSession,
    reset,
    startRecording: (discardPreRoll = false) => beginRecording('manual', discardPreRoll),
    startAutoListen: () => beginRecording('auto'),
    stopRecording,
    cancelRecording,
    holdListening,
    transcribeRecording,
    isCurrentRequest: (requestId: number) => requestId === requestIdRef.current,
  };
}
