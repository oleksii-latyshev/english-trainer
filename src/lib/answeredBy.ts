export type AnswerProviderId = 'gemini' | 'apple' | 'agy';

/** Mirrors the Rust `AnsweredBy`: the model that wrote a reply. */
export type AnsweredBy = {
  provider: AnswerProviderId;
  model: string;
  is_backup: boolean;
};

export function isAnsweredBy(value: unknown): value is AnsweredBy {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'provider' in value &&
    (value.provider === 'gemini' || value.provider === 'apple' || value.provider === 'agy') &&
    'model' in value &&
    typeof value.model === 'string' &&
    value.model.length > 0 &&
    'is_backup' in value &&
    typeof value.is_backup === 'boolean'
  );
}

/** True for a missing or null field (turns stored before origins were recorded) or a valid one. */
export function isOptionalAnsweredBy(value: unknown): value is AnsweredBy | null | undefined {
  return value === undefined || value === null || isAnsweredBy(value);
}

const GEMINI_MODEL_NAMES: Record<string, string> = {
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
};

function geminiStyleName(model: string): string {
  return GEMINI_MODEL_NAMES[model] ?? model;
}

/** Human-readable origin of a reply, for example "Apple on-device (backup)". */
export function answeredByLabel(answeredBy: AnsweredBy): string {
  switch (answeredBy.provider) {
    case 'gemini':
      return geminiStyleName(answeredBy.model);
    case 'apple':
      return answeredBy.is_backup ? 'Apple on-device (backup)' : 'Apple on-device';
    case 'agy':
      return answeredBy.model === 'default'
        ? 'Antigravity CLI'
        : `Antigravity CLI (${answeredBy.model})`;
  }
}
