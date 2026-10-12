import { Cause, type Effect, Exit, Result } from 'effect';
import { type AudioServices, audioRuntime, MIC_DISCONNECTED_MESSAGE } from '@/core/audio';

function failureOf(cause: Cause.Cause<unknown>): Error {
  const failure = Cause.findError(cause);
  if (Result.isSuccess(failure) && failure.success instanceof Error) return failure.success;
  return new Error(MIC_DISCONNECTED_MESSAGE);
}

export async function settle<A, E>(effect: Effect.Effect<A, E, AudioServices>): Promise<A> {
  const exit = await audioRuntime.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;
  throw failureOf(exit.cause);
}

export function settleSync<A, E>(effect: Effect.Effect<A, E, AudioServices>): A {
  const exit = audioRuntime.runSyncExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;
  throw failureOf(exit.cause);
}
