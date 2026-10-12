import type { Stream } from 'effect';
import type { IpcDecodeError, IpcError } from '@/core/ipc';
import type { NaturalVoiceId } from '@/core/voice-preference';

export type NaturalAvailability = 'loading' | 'ready' | 'unavailable';

export type SpeechState =
  | { tag: 'unavailable'; reason: 'unsupported' }
  | { tag: 'idle' }
  | { tag: 'starting' }
  | { tag: 'speaking' }
  | { tag: 'paused' }
  | { tag: 'error'; reason: 'empty-text' | 'voices-unavailable' | 'playback-failed' };

export type StreamOptions = {
  onStart?: (latencyMs: number) => void;
  onEnd?: () => void;
  onError?: () => void;
};

export type StreamHandle = {
  append: (delta: string) => void;
  finish: (finalText: string) => void;
  cancel: () => void;
};

export type NaturalVoiceFailure = IpcError | IpcDecodeError;

export type SpeechEngineChoice =
  | {
      readonly kind: 'natural';
      readonly voiceId: NaturalVoiceId;
      readonly fallbackVoiceURI: string | null;
    }
  | { readonly kind: 'system'; readonly voiceURI: string | null };

export type ReplyEvent =
  | { readonly _tag: 'Delta'; readonly text: string }
  | { readonly _tag: 'Final'; readonly text: string };

export type SpeechCallbacks = {
  readonly onState: (state: SpeechState) => void;
  readonly onFirstAudio: (latencyMs: number) => void;
  readonly onEnd: () => void;
  readonly onError: () => void;
  readonly onNaturalFailure: () => void;
};

export type SpeakRequest = {
  readonly engine: SpeechEngineChoice;
  readonly rate: number;
  readonly replies: Stream.Stream<ReplyEvent>;
  readonly callbacks: SpeechCallbacks;
};
