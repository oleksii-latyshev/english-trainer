import type { AnsweredBy } from '@/core/ipc';

const GEMINI_MODEL_NAMES: Record<string, string> = {
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
};

export function answeredByLabel(answeredBy: AnsweredBy): string {
  switch (answeredBy.provider) {
    case 'gemini':
      return GEMINI_MODEL_NAMES[answeredBy.model] ?? answeredBy.model;
    case 'apple':
      return answeredBy.is_backup ? 'Apple on-device (backup)' : 'Apple on-device';
    case 'agy':
      return answeredBy.model === 'default'
        ? 'Antigravity CLI'
        : `Antigravity CLI (${answeredBy.model})`;
  }
}
