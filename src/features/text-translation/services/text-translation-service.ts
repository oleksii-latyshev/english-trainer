import { Context, Effect, Layer } from 'effect';
import {
  Ipc,
  invokeCommand,
  type TextExplanation,
  TextExplanationSchema,
  type TextTranslation,
  TextTranslationSchema,
  type TranslationRequest,
} from '@/core/ipc';
import type { LookupFailure } from '../types';

type TextTranslationServiceShape = {
  readonly translate: (
    request: TranslationRequest,
  ) => Effect.Effect<TextTranslation, LookupFailure>;
  readonly explain: (request: TranslationRequest) => Effect.Effect<TextExplanation, LookupFailure>;
};

export class TextTranslationService extends Context.Service<
  TextTranslationService,
  TextTranslationServiceShape
>()('features/text-translation/TextTranslationService') {
  static readonly layer = Layer.effect(
    TextTranslationService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        translate: (request) =>
          invokeCommand(ipc, 'translate_text', TextTranslationSchema, { request }),
        explain: (request) =>
          invokeCommand(ipc, 'explain_text', TextExplanationSchema, { request }),
      };
    }),
  );
}
