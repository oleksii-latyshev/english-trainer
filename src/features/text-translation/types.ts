import type { IpcDecodeError, IpcError, TextTranslation, TranslationRequest } from '@/core/ipc';

export type LookupFailure = IpcError | IpcDecodeError;

export type SelectionAnchor = {
  readonly left: number;
  readonly top: number;
  readonly placement: 'above' | 'below';
};

export type TextSelection = {
  readonly text: string;
  readonly context: string;
  readonly anchor: SelectionAnchor;
};

export type Explanation =
  | { readonly tag: 'pending' }
  | { readonly tag: 'ready'; readonly text: string }
  | { readonly tag: 'failed'; readonly failure: LookupFailure };

export type Lookup =
  | { readonly tag: 'idle' }
  | { readonly tag: 'translating'; readonly text: string }
  | {
      readonly tag: 'translated';
      readonly request: TranslationRequest;
      readonly translation: TextTranslation;
      readonly explanation: Explanation;
    }
  | { readonly tag: 'failed'; readonly failure: LookupFailure };
