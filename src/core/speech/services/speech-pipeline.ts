import { Effect } from 'effect';
import type { SpeakRequest } from '../types';
import { collectReplies } from './pipeline/intake';
import { makePipeline, type SpeechDependencies } from './pipeline/pipeline';
import { playAll } from './pipeline/playback';
import { INITIAL_RENDER, renderLoop } from './pipeline/render';

export type { SpeechDependencies } from './pipeline/pipeline';

export function runSpeech(
  dependencies: SpeechDependencies,
  request: SpeakRequest,
): Effect.Effect<void> {
  return Effect.scoped(
    Effect.gen(function* () {
      const pipeline = yield* makePipeline(dependencies, request);
      yield* Effect.forkScoped(collectReplies(pipeline));
      yield* Effect.forkScoped(renderLoop(pipeline, INITIAL_RENDER));
      yield* playAll(pipeline);
    }),
  );
}
