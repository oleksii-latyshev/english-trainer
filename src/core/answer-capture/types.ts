import type { ActualAudioInput } from '@/core/audio';
import type { TranscriptionRecovery } from '@/core/speech';

export type RecordingMode = 'manual' | 'auto';

export type Recording = {
  readonly playbackUrl: string;
  readonly durationMs: number;
  readonly speechStoppedAtMs: number;
};

export type Listening = {
  readonly elapsedMs: number;
  readonly level: number;
  readonly mode: RecordingMode;
  readonly held: boolean;
  readonly heardSpeech: boolean;
  readonly liveText: string;
};

type WithInput = { readonly actualInput?: ActualAudioInput };

export type CaptureState =
  | ({ readonly tag: 'idle' | 'requesting' } & WithInput)
  | ({ readonly tag: 'recording' } & Listening & WithInput)
  | ({ readonly tag: 'stopping' } & Listening & WithInput)
  | ({
      readonly tag: 'ready';
      readonly failure?: TranscriptionRecovery;
    } & Recording &
      WithInput)
  | ({ readonly tag: 'transcribing' } & Recording & WithInput)
  | ({
      readonly tag: 'transcript';
      readonly text: string;
      readonly durationMs: number;
      readonly speechStoppedAtMs: number;
    } & WithInput)
  | ({
      readonly tag: 'error';
      readonly message: string;
      readonly failure?: TranscriptionRecovery;
    } & WithInput);

export type ListenRequest = {
  readonly mode: RecordingMode;
  readonly discardPreRoll: boolean;
};
