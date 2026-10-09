export const TRANSLATION_LANGUAGES = [
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)' },
  { code: 'ar', name: 'Arabic' },
] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number]['code'];
export type TranslationStatusKind =
  | 'installed'
  | 'download_required'
  | 'unsupported'
  | 'unavailable';

export type TranslationStatus = {
  native_language: TranslationLanguage;
  status: TranslationStatusKind;
  message: string;
};

export type TranslationSettings = { native_language: TranslationLanguage };
export type TranslationRequest = { word: string; context: string };
export type WordTranslation = {
  word: string;
  native_language: TranslationLanguage;
  translation: string;
  english_explanation: string | null;
  explanation_error: string | null;
};

export type TranslationErrorCode =
  | 'invalid_request'
  | 'unavailable'
  | 'unsupported_language'
  | 'download_required'
  | 'busy'
  | 'timeout'
  | 'process_failed'
  | 'invalid_output'
  | 'database_error'
  | 'cancelled';
export type TranslationError = { code: TranslationErrorCode; message: string };

export function isTranslationLanguage(value: unknown): value is TranslationLanguage {
  return TRANSLATION_LANGUAGES.some((language) => language.code === value);
}

export function isTranslationErrorCode(value: unknown): value is TranslationErrorCode {
  return (
    value === 'invalid_request' ||
    value === 'unavailable' ||
    value === 'unsupported_language' ||
    value === 'download_required' ||
    value === 'busy' ||
    value === 'timeout' ||
    value === 'process_failed' ||
    value === 'invalid_output' ||
    value === 'database_error' ||
    value === 'cancelled'
  );
}

export function isTranslationError(value: unknown): value is TranslationError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    isTranslationErrorCode(value.code) &&
    'message' in value &&
    boundedText(value.message, 500)
  );
}

export function isTranslationSettings(value: unknown): value is TranslationSettings {
  return (
    typeof value === 'object' &&
    value !== null &&
    'native_language' in value &&
    isTranslationLanguage(value.native_language)
  );
}

export function isTranslationStatus(value: unknown): value is TranslationStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'native_language' in value &&
    isTranslationLanguage(value.native_language) &&
    'status' in value &&
    (value.status === 'installed' ||
      value.status === 'download_required' ||
      value.status === 'unsupported' ||
      value.status === 'unavailable') &&
    'message' in value &&
    boundedText(value.message, 500)
  );
}

export function isWordTranslation(value: unknown): value is WordTranslation {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('word' in value) ||
    !isEnglishWord(value.word) ||
    !('native_language' in value) ||
    !isTranslationLanguage(value.native_language) ||
    !('translation' in value) ||
    !boundedText(value.translation, 300) ||
    !('english_explanation' in value) ||
    !(value.english_explanation === null || boundedText(value.english_explanation, 500)) ||
    !('explanation_error' in value) ||
    !(value.explanation_error === null || boundedText(value.explanation_error, 500))
  ) {
    return false;
  }
  return (value.english_explanation === null) !== (value.explanation_error === null);
}

export function isEnglishWord(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(value) && value.length <= 64
  );
}

export function normalizeEnglishWord(value: string): string | undefined {
  if (hasControlCharacter(value)) return undefined;
  const word = value
    .trim()
    .replace(/^[\s.,!?;:()[\]{}"“”‘’]+|[\s.,!?;:()[\]{}"“”‘’]+$/gu, '')
    .replace(/[‘’]/g, "'");
  return isEnglishWord(word) ? word : undefined;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159))) {
      return true;
    }
  }
  return false;
}

export function isSafeTranslationContext(value: string): boolean {
  if (value.length > 500) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 8 ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        (codePoint >= 127 && codePoint <= 159))
    ) {
      return false;
    }
  }
  return true;
}

export function boundedTranslationContext(value: string): string {
  const safe = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);
    const isForbiddenControl =
      codePoint !== undefined &&
      (codePoint <= 8 ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        (codePoint >= 127 && codePoint <= 159));
    return isForbiddenControl ? ' ' : character;
  }).join('');
  return safe
    .replace(/[\t\r\n\f ]+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function matchesTranslationWord(resultWord: string, requestedWord: string): boolean {
  const result = normalizeEnglishWord(resultWord);
  const requested = normalizeEnglishWord(requestedWord);
  return (
    result !== undefined &&
    requested !== undefined &&
    result.toLowerCase() === requested.toLowerCase()
  );
}

function boundedText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}
