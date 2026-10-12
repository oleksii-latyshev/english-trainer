import { Effect } from 'effect';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ActualAudioInput } from '@/core/audio';
import { isTauriRuntime } from '@/core/ipc';
import { SpeechRecognition } from '@/core/speech';
import type { CaptureState, Recording } from './capture-view';
import { settleSpeech } from './settle-speech';
import type { SpeechTiming } from './timing-panel';
import { transcriptionFailureState, transcriptState } from './transcript-state';

type Deps = {
  requestIdRef: MutableRefObject<number>;
  transcribingRef: MutableRefObject<boolean>;
  setState: Dispatch<SetStateAction<CaptureState>>;
  setTiming: Dispatch<SetStateAction<SpeechTiming>>;
  discardRecording: () => void;
};

export const BROWSER_ONLY_FAILURE = {
  kind: 'setup',
  message: 'Open the desktop app with bun run dev to use local transcription.',
} as const;

function transcribe(wav: Blob) {
  return settleSpeech(
    Effect.flatMap(SpeechRecognition, (recognition) => recognition.transcribe(wav)),
  );
}

export function createTranscriptionRunner(deps: Deps) {
  const { requestIdRef, transcribingRef, setState, setTiming, discardRecording } = deps;

  function succeeded(
    requestId: number,
    answer: { text: string; sttMs: number },
    recording: Recording,
    actualInput?: ActualAudioInput,
  ) {
    if (requestId !== requestIdRef.current) return;
    setTiming((current) => ({ ...current, sttMs: answer.sttMs }));
    discardRecording();
    setState(transcriptState(answer.text, recording, actualInput));
  }

  function failed(
    requestId: number,
    cause: unknown,
    recording: Recording,
    actualInput?: ActualAudioInput,
  ) {
    if (requestId !== requestIdRef.current) return;
    const outcome = transcriptionFailureState(recording, cause, actualInput);
    if (!outcome.keepsRecording) discardRecording();
    setState(outcome.state);
  }

  return async function runTranscription(
    requestId: number,
    recording: Recording,
    wav: Blob,
    actualInput?: ActualAudioInput,
  ) {
    if (!isTauriRuntime()) {
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
      succeeded(requestId, await transcribe(wav), recording, actualInput);
    } catch (cause) {
      failed(requestId, cause, recording, actualInput);
    } finally {
      transcribingRef.current = false;
    }
  };
}
