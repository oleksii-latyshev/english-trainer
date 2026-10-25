import type { AnswerFeedback } from '../../types';

const MAX_PHRASE_CHARS = 300;

const STRONGER_PHRASING_NOTE = 'Stronger phrasing from conversation feedback';

export function phraseToSave(feedback: AnswerFeedback): { phrase: string; note: string } | null {
  const focus = feedback.focus_feedback[0];
  const phrase = focus ? focus.improved : feedback.b2_rewrite;
  if (phrase.trim().length === 0 || phrase.length > MAX_PHRASE_CHARS) return null;
  return { phrase, note: focus ? focus.explanation : STRONGER_PHRASING_NOTE };
}
