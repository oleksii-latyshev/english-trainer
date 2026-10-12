import { Cause, type Effect, Exit } from 'effect';
import { type SpeechRecognitionServices, speechRecognitionRuntime } from '@/core/speech';

export async function settleSpeech<A, E>(
  effect: Effect.Effect<A, E, SpeechRecognitionServices>,
): Promise<A> {
  const exit = await speechRecognitionRuntime.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;
  throw Cause.squash(exit.cause);
}
