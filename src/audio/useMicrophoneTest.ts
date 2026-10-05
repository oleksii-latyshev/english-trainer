import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioSignalSummary } from './audioSignal';
import { microphoneError } from './microphoneError';
import { type PcmRecorder, startPcmRecording } from './recordPcm';
import type { ActualAudioInput } from './types';

export const MICROPHONE_TEST_DURATION_MS = 10_000;

export type MicrophoneTestState =
  | { tag: 'idle' }
  | { tag: 'requesting' }
  | { tag: 'recording'; elapsedMs: number; level?: number; actualInput?: ActualAudioInput }
  | { tag: 'stopping'; elapsedMs: number; level?: number; actualInput?: ActualAudioInput }
  | {
      tag: 'recorded';
      playbackUrl: string;
      durationMs: number;
      signal: AudioSignalSummary;
      actualInput?: ActualAudioInput;
    }
  | { tag: 'error'; message: string };

export function useMicrophoneTest(selectedDeviceId: string, onRecordingFinished?: () => void) {
  const [state, setState] = useState<MicrophoneTestState>({ tag: 'idle' });
  const recorderRef = useRef<PcmRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const discardTest = useCallback(() => {
    requestIdRef.current += 1;
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    void recorder?.cancel().catch((cause) => {
      if (mountedRef.current) setState({ tag: 'error', message: microphoneError(cause) });
    });
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    setState({ tag: 'idle' });
  }, [clearTimers]);

  const stopTest = useCallback(
    async (targetRequestId?: number) => {
      const activeRequestId = targetRequestId ?? requestIdRef.current;
      const recorder = recorderRef.current;
      if (!recorder || activeRequestId !== requestIdRef.current) return;
      recorderRef.current = null;
      clearTimers();

      setState((current) =>
        current.tag === 'recording'
          ? { tag: 'stopping', elapsedMs: current.elapsedMs, actualInput: current.actualInput }
          : current,
      );

      try {
        const result = await recorder.stop();
        if (activeRequestId !== requestIdRef.current || !mountedRef.current) return;

        const url = URL.createObjectURL(result.wav);
        playbackUrlRef.current = url;
        setState({
          tag: 'recorded',
          playbackUrl: url,
          durationMs: result.durationMs,
          signal: result.signal,
          actualInput: recorder.actualInput,
        });

        onRecordingFinished?.();
      } catch (cause) {
        if (activeRequestId === requestIdRef.current && mountedRef.current) {
          setState({ tag: 'error', message: microphoneError(cause) });
        }
      }
    },
    [clearTimers, onRecordingFinished],
  );

  const startTest = useCallback(async () => {
    if (
      startingRef.current ||
      recorderRef.current ||
      state.tag === 'requesting' ||
      state.tag === 'recording' ||
      state.tag === 'stopping'
    )
      return;

    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }

    startingRef.current = true;
    const requestId = ++requestIdRef.current;
    setState({ tag: 'requesting' });

    try {
      const recorder = await startPcmRecording(
        () => {
          if (requestId === requestIdRef.current && mountedRef.current) {
            const lostRecorder = recorderRef.current;
            recorderRef.current = null;
            void lostRecorder?.cancel().catch((cause) => {
              if (mountedRef.current) setState({ tag: 'error', message: microphoneError(cause) });
            });
            clearTimers();
            setState({
              tag: 'error',
              message: 'The microphone disconnected during recording. Reconnect it and try again.',
            });
          }
        },
        { deviceId: selectedDeviceId },
      );

      if (requestId !== requestIdRef.current || !mountedRef.current) {
        await recorder.cancel();
        return;
      }

      recorderRef.current = recorder;
      const trackInput = recorder.actualInput;
      const startedAt = performance.now();

      timerRef.current = setInterval(() => {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setState((current) =>
          current.tag === 'recording'
            ? { ...current, elapsedMs: performance.now() - startedAt, level: recorder.level() }
            : current,
        );
      }, 100);

      autoStopTimerRef.current = setTimeout(() => {
        void stopTest(requestId);
      }, MICROPHONE_TEST_DURATION_MS);

      setState({ tag: 'recording', elapsedMs: 0, actualInput: trackInput });
    } catch (cause) {
      if (requestId === requestIdRef.current && mountedRef.current) {
        setState({ tag: 'error', message: microphoneError(cause) });
      }
    } finally {
      startingRef.current = false;
    }
  }, [clearTimers, selectedDeviceId, state.tag, stopTest]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      clearTimers();
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }
      // After unmount there is no UI to report cleanup failure; captured data is already released.
      void recorderRef.current?.cancel().catch(() => {});
      recorderRef.current = null;
    };
  }, [clearTimers]);

  const isCapturing =
    state.tag === 'requesting' || state.tag === 'recording' || state.tag === 'stopping';

  return {
    state,
    isCapturing,
    startTest,
    stopTest: () => void stopTest(),
    discardTest,
  };
}
