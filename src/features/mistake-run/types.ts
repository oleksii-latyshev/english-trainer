export type ExercisePhase = 'open' | 'passed' | 'missed' | 'checking' | 'check-failed';

export type SpokenTarget = { readonly runId: number; readonly position: number };

export type SpokenView =
  | { readonly tag: 'idle' }
  | { readonly tag: 'busy' }
  | { readonly tag: 'requesting' }
  | { readonly tag: 'recording'; readonly liveText: string }
  | { readonly tag: 'transcribing' }
  | { readonly tag: 'saving' }
  | { readonly tag: 'failed'; readonly message: string; readonly canRetryTranscription: boolean };
