import { useEffect, useRef, useState } from 'react';
import { microphoneError } from '@/audio/microphoneError';
import { type PcmRecorder, startPcmRecording } from '@/audio/recordPcm';
import { speechErrorMessage } from '@/lib/speechTypes';

/** A sentence is a few seconds; this only stops a recording the learner forgot. */
const MAX_RECORDING_MS = 30_000;
const MIN_RECORDING_MS = 800;
const LEVEL_POLL_MS = 100;

export type SentenceRecorderState =
  | { tag: 'idle' }
  | { tag: 'requesting' }
  | { tag: 'recording'; level: number }
  | { tag: 'saving' }
  | { tag: 'error'; message: string };

async function finishRecording(
  recorder: PcmRecorder,
): Promise<{ tag: 'wav'; wav: Blob } | { tag: 'error'; message: string }> {
  try {
    const audio = await recorder.stop();
    if (audio.durationMs < MIN_RECORDING_MS) {
      return { tag: 'error', message: 'That was too short. Read the whole sentence.' };
    }
    return { tag: 'wav', wav: audio.wav };
  } catch (cause) {
    return { tag: 'error', message: microphoneError(cause) };
  }
}

/**
 * Records one sentence at a time on its own microphone session and hands the finished WAV to
 * `save`. A recording that is too short is reported instead of saved.
 */
export function useSentenceRecorder(deviceId: string, save: (wav: Blob) => Promise<void>) {
  const [state, setState] = useState<SentenceRecorderState>({ tag: 'idle' });
  const recorderRef = useRef<PcmRecorder | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const saveRef = useRef(save);
  saveRef.current = save;

  function clearTimers() {
    if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    levelTimerRef.current = null;
    limitTimerRef.current = null;
  }

  async function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    clearTimers();
    const request = requestRef.current;
    setState({ tag: 'saving' });
    const finished = await finishRecording(recorder);
    if (request !== requestRef.current) return;
    if (finished.tag === 'error') {
      setState(finished);
      return;
    }
    try {
      await saveRef.current(finished.wav);
      if (request === requestRef.current) setState({ tag: 'idle' });
    } catch (cause) {
      if (request === requestRef.current) {
        setState({
          tag: 'error',
          message: speechErrorMessage(cause, 'The recording could not be saved. Try again.'),
        });
      }
    }
  }

  async function start() {
    if (state.tag !== 'idle' && state.tag !== 'error') return;
    const request = ++requestRef.current;
    setState({ tag: 'requesting' });
    try {
      const recorder = await startPcmRecording(
        () => {
          if (request !== requestRef.current) return;
          const lost = recorderRef.current;
          recorderRef.current = null;
          clearTimers();
          // The device is gone; there is nothing more to release than the capture itself.
          void lost?.cancel().catch(() => {});
          setState({
            tag: 'error',
            message: 'The microphone disconnected. Reconnect it and record the sentence again.',
          });
        },
        { deviceId },
      );
      if (request !== requestRef.current) {
        await recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
      levelTimerRef.current = setInterval(() => {
        setState((current) =>
          current.tag === 'recording' ? { tag: 'recording', level: recorder.level() } : current,
        );
      }, LEVEL_POLL_MS);
      limitTimerRef.current = setTimeout(() => void stop(), MAX_RECORDING_MS);
      setState({ tag: 'recording', level: 0 });
    } catch (cause) {
      if (request === requestRef.current) {
        setState({ tag: 'error', message: microphoneError(cause) });
      }
    }
  }

  function dismissError() {
    setState((current) => (current.tag === 'error' ? { tag: 'idle' } : current));
  }

  useEffect(
    () => () => {
      requestRef.current += 1;
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
      // After unmount there is no UI left to report a failed release.
      void recorderRef.current?.cancel().catch(() => {});
      recorderRef.current = null;
    },
    [],
  );

  return { state, start, stop: () => void stop(), dismissError };
}
