export type GuidedAnswer = { model_answer: string; adaptation: string };

function isExampleText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Array.from(value).length <= 500 &&
    Array.from(value).every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && !(code >= 127 && code <= 159);
    }) &&
    !/[`{}#*]/u.test(value) &&
    value.trim().split(/\s+/u).length <= 60
  );
}

export function isGuidedAnswer(value: unknown): value is GuidedAnswer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'model_answer' in value &&
    isExampleText(value.model_answer) &&
    !/[[\]]/u.test(value.model_answer) &&
    'adaptation' in value &&
    isExampleText(value.adaptation) &&
    value.adaptation.includes('[') &&
    value.adaptation.includes(']')
  );
}
