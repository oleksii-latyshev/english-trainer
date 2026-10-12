import { Context, Effect, Layer, Schema } from 'effect';
import { Ipc, invokeCommand } from '@/core/ipc';
import type { GlossaryFailure } from '../types';

const TermsSchema = Schema.Array(Schema.String);

type GlossaryServiceShape = {
  readonly get: Effect.Effect<readonly string[], GlossaryFailure>;
  readonly save: (terms: readonly string[]) => Effect.Effect<readonly string[], GlossaryFailure>;
};

export class GlossaryService extends Context.Service<GlossaryService, GlossaryServiceShape>()(
  'features/glossary/GlossaryService',
) {
  static readonly layer = Layer.effect(
    GlossaryService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        get: invokeCommand(ipc, 'get_glossary', TermsSchema),
        save: (terms) => invokeCommand(ipc, 'save_glossary', TermsSchema, { terms }),
      };
    }),
  );
}
