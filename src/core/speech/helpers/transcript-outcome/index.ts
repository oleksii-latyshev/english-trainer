import { type TranscriptionRecovery, transcriptionRecovery } from '../transcription-recovery';

export type TranscriptOutcome =
  | { readonly tag: 'transcript'; readonly text: string }
  | { readonly tag: 'no-speech'; readonly failure: TranscriptionRecovery };

export type TranscriptionFailureOutcome = {
  readonly failure: TranscriptionRecovery;
  readonly keepsRecording: boolean;
};

const NO_SPEECH_DETECTED = 'No speech was detected. Try speaking closer to the microphone.';

export function transcriptOutcome(text: string): TranscriptOutcome {
  if (!text.trim()) {
    return { tag: 'no-speech', failure: { kind: 'record_again', message: NO_SPEECH_DETECTED } };
  }
  return { tag: 'transcript', text };
}

export function transcriptionFailureOutcome(cause: unknown): TranscriptionFailureOutcome {
  const failure = transcriptionRecovery(cause);
  return { failure, keepsRecording: failure.kind !== 'record_again' };
}
