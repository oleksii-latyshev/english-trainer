import type { MicrophoneError } from '@/core/audio';
import type { IpcDecodeError, IpcError, RescueKind, RescueResponseSchema } from '@/core/ipc';

export type RescueAnswer = typeof RescueResponseSchema.Type;

export type RescueFailure = IpcError | IpcDecodeError | MicrophoneError;

export type RescueTarget = {
  readonly sessionId: number;
  readonly sequence: number;
  readonly question: string;
  readonly recordingId: number;
  readonly key: string;
};

export type RescueState =
  | { readonly tag: 'closed' }
  | { readonly tag: 'loading'; readonly kind: RescueKind; readonly description: string }
  | {
      readonly tag: 'answer';
      readonly kind: RescueKind;
      readonly description: string;
      readonly answer: RescueAnswer;
    }
  | { readonly tag: 'missing-word'; readonly description: string }
  | { readonly tag: 'selected'; readonly term: string }
  | {
      readonly tag: 'error';
      readonly kind: RescueKind;
      readonly description: string;
      readonly failure: RescueFailure;
    };

export type RescueEntry = { readonly key: string; readonly state: RescueState };

export type RescueRequestInput = {
  readonly target: RescueTarget;
  readonly kind: RescueKind;
  readonly description: string;
};
