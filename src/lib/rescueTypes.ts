export type RescueKind = 'next_step' | 'simpler' | 'missing_word';

export type RescueRequest = {
  kind: RescueKind;
  question: string;
  partial_transcript: string;
  description: string;
};

export type RescueResponse =
  | { kind: 'next_step'; suggestion: string }
  | { kind: 'simpler'; suggestion: string }
  | { kind: 'missing_word'; candidates: string[] };

const MAX_SUGGESTION_CHARS = 160;
const MAX_CANDIDATE_CHARS = 64;

export function isRescueResponse(
  value: unknown,
  expectedKind: RescueKind,
): value is RescueResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !hasExactKeys(value, expectedKeys(expectedKind))
  ) {
    return false;
  }
  if (!('kind' in value) || value.kind !== expectedKind) return false;
  if (expectedKind === 'missing_word') {
    return 'candidates' in value && isCandidates(value.candidates);
  }
  return 'suggestion' in value && isSuggestion(value.suggestion);
}

function expectedKeys(kind: RescueKind): string[] {
  return kind === 'missing_word' ? ['candidates', 'kind'] : ['kind', 'suggestion'];
}

function hasExactKeys(value: object, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isSuggestion(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (
    text.length === 0 ||
    Array.from(text).length > MAX_SUGGESTION_CHARS ||
    text.split(/\s+/u).length > 30 ||
    !/[A-Za-z]/u.test(text) ||
    hasUnsafeCharacters(value) ||
    /[`*_#{}<>]/u.test(text) ||
    text.includes('](') ||
    startsAsMarkdownList(text)
  ) {
    return false;
  }
  return true;
}

function hasUnsafeCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (
      code < 32 ||
      (code >= 127 && code <= 159) ||
      (/\p{L}/u.test(character) && !/[A-Za-z]/u.test(character))
    );
  });
}

function startsAsMarkdownList(value: string): boolean {
  if (['- ', '* ', '+ ', '> '].some((prefix) => value.startsWith(prefix))) return true;
  return ['. ', ') '].some((separator) => {
    const index = value.indexOf(separator);
    if (index <= 0) return false;
    return Array.from(value.slice(0, index)).every((character) => /[0-9]/u.test(character));
  });
}

function isCandidates(value: unknown): value is string[] {
  if (!isUnknownArray(value) || value.length < 3 || value.length > 5) return false;
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !isCandidate(candidate)) return false;
    const normalized = candidate.trim().toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
  }
  return true;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isCandidate(value: string): boolean {
  const text = value.trim();
  if (
    text.length === 0 ||
    Array.from(text).length > MAX_CANDIDATE_CHARS ||
    text.split(/\s+/u).length > 3 ||
    hasUnsafeCharacters(value)
  ) {
    return false;
  }
  return text.split(/\s+/u).every((word) => /^[A-Za-z]+(?:['-][A-Za-z]+)*$/u.test(word));
}
