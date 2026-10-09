import { isTauri } from '@tauri-apps/api/core';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ActualAudioInput } from '@/audio/types';
import type { CaptureState, Recording } from './captureView';
import type { SpeechTiming } from './TimingPanel';
import { transcribeWav } from './transcribeWav';
import { transcriptionErrorOutcome, transcriptOutcome } from './transcriptOutcome';

type Deps = {
  requestIdRef: MutableRefObject<number>;
  transcribingRef: MutableRefObject<boolean>;
  setState: Dispatch<SetStateAction<CaptureState>>;
  setTiming: Dispatch<SetStateAction<SpeechTiming>>;
  discardRecording: () => void;
};

/** Transcribes a finished recording; results for a superseded request are dropped. */
export function createTranscriptionRunner(deps: Deps) {
  const { requestIdRef, transcribingRef, setState, setTiming, discardRecording } = deps;

  return async function runTranscription(
    requestId: number,
    recording: Recording,
    wav: Blob,
    actualInput?: ActualAudioInput,
  ) {
    if (!isTauri()) {
      setState({ ...recording, tag: 'ready', actualInput, failure: BROWSER_ONLY_FAILURE });
      return;
    }
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
      if (requestId !== requestIdRef.current) return;
      setTiming((current) => ({ ...current, sttMs }));
      discardRecording();
      setState(transcriptOutcome(text, recording, actualInput));
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      const outcome = transcriptionErrorOutcome(recording, cause, actualInput);
      if (!outcome.keepsRecording) discardRecording();
      setState(outcome.state);
    } finally {
      transcribingRef.current = false;
    }
  };
}

/** Shown when the UI runs in a plain browser, where local transcription is unavailable. */
export const BROWSER_ONLY_FAILURE = {
  kind: 'setup',
  message: 'Open the desktop app with bun run dev to use local transcription.',
} as const;
