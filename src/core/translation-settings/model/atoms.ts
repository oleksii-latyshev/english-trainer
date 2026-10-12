import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { TranslationSettingsService } from '../services/translation-settings-service';
import { runtime } from './runtime';

const NATIVE_LANGUAGE = ['translation-native-language'];
const AVAILABILITY = ['translation-availability'];

export const nativeLanguageAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* TranslationSettingsService;
      const settings = yield* service.get;
      return settings.native_language;
    }),
  )
  .pipe(Atom.runtime.withReactivity(NATIVE_LANGUAGE));

export const setNativeLanguageAtom = runtime.fn(
  Effect.fn('setNativeLanguage')(function* (language: string) {
    const service = yield* TranslationSettingsService;
    const saved = yield* service.save({ native_language: language });
    return saved.native_language;
  }),
  { reactivityKeys: [...NATIVE_LANGUAGE, ...AVAILABILITY] },
);

export const translationAvailabilityAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* TranslationSettingsService;
      return yield* service.status;
    }),
  )
  .pipe(Atom.runtime.withReactivity(AVAILABILITY));

export const prepareTranslationLanguagesAtom = runtime.fn(
  Effect.fn('prepareTranslationLanguages')(function* () {
    const service = yield* TranslationSettingsService;
    return yield* service.prepare;
  }),
  { reactivityKeys: AVAILABILITY },
);
