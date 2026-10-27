const MAX_PHRASE_WORDS = 8;
export const MAX_PHRASE_CHARS = 120;
const MAX_CONTEXT_CHARS = 500;

const SENTENCE_PUNCTUATION = new Set([',', '.', ';', ':', '!', '?', '"', '(', ')', '“', '”']);
const FORBIDDEN_SEQUENCES = ['--', "''", "'-", "-'"];

function isForbiddenControl(codePoint: number): boolean {
  return (
    codePoint <= 8 ||
    codePoint === 11 ||
    codePoint === 12 ||
    (codePoint >= 14 && codePoint <= 31) ||
    (codePoint >= 127 && codePoint <= 159)
  );
}

function hasForbiddenControl(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && isForbiddenControl(codePoint)) return true;
  }
  return false;
}

function isAsciiLetter(character: string): boolean {
  return /^[A-Za-z]$/.test(character);
}

function isAsciiAlphanumeric(character: string): boolean {
  return /^[A-Za-z0-9]$/.test(character);
}

function trimCharacters(value: string, isTrimmed: (character: string) => boolean): string {
  const characters = Array.from(value);
  let start = 0;
  let end = characters.length;
  while (start < end && isTrimmed(characters[start] ?? '')) start += 1;
  while (end > start && isTrimmed(characters[end - 1] ?? '')) end -= 1;
  return characters.slice(start, end).join('');
}

function isSentencePunctuation(character: string): boolean {
  return SENTENCE_PUNCTUATION.has(character);
}

function isOuterPunctuation(character: string): boolean {
  return isSentencePunctuation(character) || character === "'";
}

function isPhraseToken(token: string): boolean {
  const core = trimCharacters(token, isSentencePunctuation);
  const characters = Array.from(core);
  const first = characters[0];
  const last = characters[characters.length - 1];
  const hasAlphanumericEdges =
    first !== undefined &&
    last !== undefined &&
    isAsciiAlphanumeric(first) &&
    isAsciiAlphanumeric(last);
  return (
    hasAlphanumericEdges &&
    Array.from(token).every(
      (character) =>
        isAsciiAlphanumeric(character) ||
        isSentencePunctuation(character) ||
        character === "'" ||
        character === '-',
    ) &&
    !FORBIDDEN_SEQUENCES.some((sequence) => core.includes(sequence))
  );
}

export function normalizePhrase(value: string): string | undefined {
  if (hasForbiddenControl(value)) return undefined;
  const collapsed = value
    .replace(/[‘’]/g, "'")
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .join(' ');
  const phrase = trimCharacters(collapsed, isOuterPunctuation);
  const tokens = phrase.split(' ');
  const isBounded =
    phrase.length > 0 &&
    Array.from(phrase).length <= MAX_PHRASE_CHARS &&
    tokens.length <= MAX_PHRASE_WORDS;
  const hasLetter = Array.from(phrase).some(isAsciiLetter);
  return isBounded && hasLetter && tokens.every(isPhraseToken) ? phrase : undefined;
}

export function boundedContext(value: string): string {
  const safe = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && isForbiddenControl(codePoint) ? ' ' : character;
  }).join('');
  return safe
    .replace(/[\t\r\n\f ]+/g, ' ')
    .trim()
    .slice(0, MAX_CONTEXT_CHARS);
}
