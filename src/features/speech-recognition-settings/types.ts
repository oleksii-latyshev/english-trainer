import type { MicrophoneError } from '@/core/audio';
import type { SpeechRecognitionFailure } from '@/core/speech';
import type { SentenceTooShort } from './errors';

export type SentenceFailure = MicrophoneError | SentenceTooShort | SpeechRecognitionFailure;

export type SentenceRecorderState =
  | { readonly tag: 'idle' }
  | { readonly tag: 'requesting' }
  | { readonly tag: 'recording'; readonly level: number }
  | { readonly tag: 'saving' }
  | { readonly tag: 'error'; readonly failure: SentenceFailure };
