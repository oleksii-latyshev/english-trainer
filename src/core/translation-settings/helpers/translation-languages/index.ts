export const TRANSLATION_LANGUAGES = [
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh-Hans', label: 'Chinese (Simplified)' },
  { value: 'ar', label: 'Arabic' },
] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number]['value'];

export function isTranslationLanguage(value: string): value is TranslationLanguage {
  return TRANSLATION_LANGUAGES.some((language) => language.value === value);
}
