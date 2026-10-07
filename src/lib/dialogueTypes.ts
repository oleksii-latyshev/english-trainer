import { type AnsweredBy, isOptionalAnsweredBy } from '@/lib/answeredBy';

export type PracticeDialogueTurn = {
  learner: string;
  assistant_reply: string;
  assistant_question: string;
  answered_by?: AnsweredBy | null;
};

export type PracticeDialogue = {
  session_id: number;
  opening_question: string;
  turns: PracticeDialogueTurn[];
  input_sources?: ('voice' | 'edited' | 'text')[];
};

export function isPracticeDialogueTurn(value: unknown): value is PracticeDialogueTurn {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'learner' in value &&
    typeof value.learner === 'string' &&
    'assistant_reply' in value &&
    typeof value.assistant_reply === 'string' &&
    'assistant_question' in value &&
    typeof value.assistant_question === 'string' &&
    (!('answered_by' in value) || isOptionalAnsweredBy(value.answered_by))
  );
}

export function isPracticeDialogue(value: unknown): value is PracticeDialogue {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'session_id' in value &&
    typeof value.session_id === 'number' &&
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0 &&
    'opening_question' in value &&
    typeof value.opening_question === 'string' &&
    'turns' in value &&
    Array.isArray(value.turns) &&
    value.turns.every(isPracticeDialogueTurn) &&
    (!('input_sources' in value) ||
      (Array.isArray(value.input_sources) &&
        value.input_sources.length === value.turns.length &&
        value.input_sources.every(
          (source) => source === 'voice' || source === 'edited' || source === 'text',
        )))
  );
}
