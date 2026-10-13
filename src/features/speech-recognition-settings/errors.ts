import { Data } from 'effect';

export class SentenceTooShort extends Data.TaggedError('SentenceTooShort')<{
  readonly durationMs: number;
}> {}
