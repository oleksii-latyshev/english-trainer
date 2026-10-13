import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ClipPhase } from '@/core/audio';
import { ipcFailureMessage } from '@/core/ipc';
import type { SentenceFailure, SentenceRecorderState } from '../../types';

export const MAX_SENTENCE_MS = 30_000;
export const MIN_SENTENCE_MS = 800;

const TOO_SHORT_MESSAGE = 'That was too short. Read the whole sentence.';
const DISCONNECTED_MESSAGE =
  'The microphone disconnected. Reconnect it and record the sentence again.';
const SAVE_FALLBACK = 'The recording could not be saved. Try again.';

type Input = {
  readonly phase: ClipPhase;
  readonly run: AsyncResult.AsyncResult<unknown, SentenceFailure>;
  readonly isSaving: boolean;
};

function runningState(phase: ClipPhase, isSaving: boolean): SentenceRecorderState {
  if (isSaving || phase.tag === 'stopping') return { tag: 'saving' };
  if (phase.tag === 'recording') return { tag: 'recording', level: phase.level };
  return { tag: 'requesting' };
}

export function sentenceRecorderState({ phase, run, isSaving }: Input): SentenceRecorderState {
  if (AsyncResult.isWaiting(run)) return runningState(phase, isSaving);
  const failure = AsyncResult.error(run);
  return Option.isSome(failure) ? { tag: 'error', failure: failure.value } : { tag: 'idle' };
}

export function sentenceFailureMessage(failure: SentenceFailure): string {
  switch (failure._tag) {
    case 'SentenceTooShort':
      return TOO_SHORT_MESSAGE;
    case 'MicrophoneError':
      return failure.reason === 'disconnected' ? DISCONNECTED_MESSAGE : failure.message;
    case 'IpcError':
    case 'IpcDecodeError':
      return ipcFailureMessage(failure, SAVE_FALLBACK);
  }
}

export function recorderHint(state: SentenceRecorderState, isRecorded: boolean): string {
  switch (state.tag) {
    case 'requesting':
      return 'Preparing the microphone (about 3 seconds). Wait for the bars to move before reading.';
    case 'recording':
      return 'Recording. Read the sentence, then press stop.';
    case 'saving':
      return 'Saving the recording…';
    case 'error':
      return sentenceFailureMessage(state.failure);
    case 'idle':
      return isRecorded
        ? 'Recorded. Press the microphone to read it again and replace the recording.'
        : 'Press the microphone, read the sentence aloud, then press stop.';
  }
}

export function micName(isRecording: boolean, isRecorded: boolean): string {
  if (isRecording) return 'Stop recording';
  return isRecorded ? 'Record this sentence again' : 'Record this sentence';
}
