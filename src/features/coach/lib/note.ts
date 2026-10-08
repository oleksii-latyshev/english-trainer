import type { TurnCoaching } from '@/lib/coachingTypes';
import type { AttemptComparison, TurnFeedback } from '@/lib/types';

/** What the coaching note under an answer shows. */
export type NoteView =
  | { tag: 'checking' }
  | { tag: 'paused' }
  | { tag: 'failed' }
  | { tag: 'ready'; feedback: TurnFeedback };

/** Longest phrase Memory takes (`save_phrase` in Rust). */
const MAX_PHRASE_CHARS = 300;

const STRONGER_PHRASING_NOTE = 'Stronger phrasing from conversation feedback';

export function noteView(coaching: TurnCoaching): NoteView {
  switch (coaching.state) {
    case 'pending':
      return { tag: 'checking' };
    case 'ready':
      return { tag: 'ready', feedback: coaching.feedback };
    case 'paused':
    case 'failed':
      return { tag: coaching.state };
  }
}

/**
 * The phrase "Save phrase" keeps: the improved wording of the focus point, else the whole natural
 * rewrite. Null when it is too long for a Memory card.
 */
export function phraseToSave(feedback: TurnFeedback): { phrase: string; note: string } | null {
  const focus = feedback.focus_feedback[0];
  const phrase = focus ? focus.improved : feedback.b2_rewrite;
  if (phrase.trim().length === 0 || phrase.length > MAX_PHRASE_CHARS) return null;
  return { phrase, note: focus ? focus.explanation : STRONGER_PHRASING_NOTE };
}

/** The second try used the improved wording ("✓ You used …"). */
export function usedImprovedWording(comparison: AttemptComparison): boolean {
  return (
    comparison.target.length > 0 &&
    (comparison.target_evidence === 'newly_observed_in_retry' ||
      comparison.target_evidence === 'already_present_in_both')
  );
}

/** A quiet line about a second try that did not show the improved wording; empty when unsure. */
export function secondTryHint(comparison: AttemptComparison): string {
  if (comparison.target.length === 0) return '';
  switch (comparison.target_evidence) {
    case 'partially_observed':
      return `Close. Part of “${comparison.target}” was there.`;
    case 'not_observed':
      return `Try “${comparison.target}” once more.`;
    default:
      return '';
  }
}

/** The newest answer whose coaching is paused (counting from 1); only it says so. */
export function latestPausedSequence(coaching: readonly TurnCoaching[] | undefined): number | null {
  if (!coaching) return null;
  for (let index = coaching.length - 1; index >= 0; index--) {
    if (coaching[index].state === 'paused') return index + 1;
  }
  return null;
}

/** A note is open by default only under the newest answer; the learner can change that. */
export function isNoteOpen(
  override: boolean | undefined,
  sequence: number,
  turnCount: number,
): boolean {
  return override ?? sequence === turnCount;
}
