import { type AnsweredBy, isOptionalAnsweredBy } from '@/lib/answeredBy';
import { isTurnCoaching, type TurnCoaching } from './coachingTypes';

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
  /** Per turn: time to Eva's first words in ms; null for turns stored before it was kept. */
  reply_times_ms?: (number | null)[];
  /** Per turn: how long a spoken answer lasted in ms; null for typed or older answers. */
  answer_durations_ms?: (number | null)[];
  /** Per turn: help was opened for the answer before it was sent. */
  help_used?: boolean[];
  /** Per turn: where the background coaching of the learner's answer stands. */
  coaching?: TurnCoaching[];
};

function isMillisecondsOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

/** An optional per-turn list: absent, or exactly one valid entry per turn. */
function isPerTurnList(
  value: object,
  key: string,
  turnCount: number,
  isEntry: (entry: unknown) => boolean,
): boolean {
  if (!(key in value)) return true;
  const list: unknown = Reflect.get(value, key);
  return Array.isArray(list) && list.length === turnCount && list.every(isEntry);
}

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
        ))) &&
    isPerTurnList(value, 'reply_times_ms', value.turns.length, isMillisecondsOrNull) &&
    isPerTurnList(value, 'answer_durations_ms', value.turns.length, isMillisecondsOrNull) &&
    isPerTurnList(value, 'help_used', value.turns.length, (entry) => typeof entry === 'boolean') &&
    isPerTurnList(value, 'coaching', value.turns.length, isTurnCoaching)
  );
}
