/** IPC counterpart of providers::AnswerPlan; validation mirrors parse_answer_plan in Rust. */
export type AnswerPlan = {
  frame: [string, string, string];
  phrases: string[];
  model_answer: string;
  adaptation: string;
};

function isSafeText(value: unknown, maxChars: number, maxWords: number): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (Array.from(value).length > maxChars || value.trim().split(/\s+/u).length > maxWords) {
    return false;
  }
  if (
    Array.from(value).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || (code >= 127 && code <= 159);
    })
  ) {
    return false;
  }
  if (
    Array.from(value).some((character) => /\p{L}/u.test(character) && !/[A-Za-z]/u.test(character))
  ) {
    return false;
  }
  return !containsMarkdown(value.trim());
}

function containsMarkdown(value: string): boolean {
  const startsAsList =
    value.startsWith('- ') ||
    value.startsWith('* ') ||
    value.startsWith('+ ') ||
    value.startsWith('> ') ||
    ['. ', ') '].some((separator) => {
      const [prefix] = value.split(separator, 1);
      return prefix.length > 0 && Array.from(prefix).every((character) => /[0-9]/u.test(character));
    });
  return /[`*_#{}<>]/u.test(value) || startsAsList || value.includes('](');
}

function hasAdaptationSlot(value: string): boolean {
  const open = value.indexOf('[');
  const close = value.indexOf(']');
  return open >= 0 && close > open + 1;
}

function hasExpectedKeys(value: object): boolean {
  const expectedKeys = ['adaptation', 'frame', 'model_answer', 'phrases'];
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    !actualKeys.some((key, index) => key !== expectedKeys[index])
  );
}

function isShortList(value: unknown, minLength: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= minLength &&
    value.length <= maxLength &&
    value.every((item: unknown) => isSafeText(item, 120, 60))
  );
}

export function isAnswerPlan(value: unknown): value is AnswerPlan {
  if (typeof value !== 'object' || value === null || !hasExpectedKeys(value)) return false;
  if (!('frame' in value) || !isShortList(value.frame, 3, 3)) return false;
  if (!('phrases' in value) || !isShortList(value.phrases, 3, 5)) return false;
  if (!('model_answer' in value) || !isSafeText(value.model_answer, 500, 60)) return false;
  if (value.model_answer.includes('[') || value.model_answer.includes(']')) return false;
  if (!/[.!?…]$/u.test(value.model_answer.trimEnd())) return false;
  if (!('adaptation' in value) || !isSafeText(value.adaptation, 500, 60)) return false;
  return hasAdaptationSlot(value.adaptation);
}
