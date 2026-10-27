import { Data } from 'effect';

export class ProfileTooLong extends Data.TaggedError('ProfileTooLong')<{
  readonly field: string;
  readonly limit: number;
}> {}
