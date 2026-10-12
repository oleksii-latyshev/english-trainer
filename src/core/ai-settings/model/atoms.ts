import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { AiSettings } from '@/core/ipc';
import { AiSettingsService } from '../services/ai-settings-service';
import { runtime } from './runtime';

const AI_SETTINGS = ['ai-settings'];

export const aiSettingsAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* AiSettingsService;
      return yield* service.get;
    }),
  )
  .pipe(Atom.runtime.withReactivity(AI_SETTINGS));

export const updateAiSettingsAtom = runtime.fn(
  Effect.fn('updateAiSettings')(function* (change: Partial<AiSettings>) {
    const service = yield* AiSettingsService;
    const current = yield* service.get;
    return yield* service.save({ ...current, ...change });
  }),
  { reactivityKeys: AI_SETTINGS },
);

export const prewarmConversationProviderAtom = runtime.fn(
  Effect.fn('prewarmConversationProvider')(function* () {
    const service = yield* AiSettingsService;
    yield* service.prewarm;
  }),
);
