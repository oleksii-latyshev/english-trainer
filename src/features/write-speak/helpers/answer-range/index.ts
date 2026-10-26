import type { AnswerCoaching, FeedbackCounts, WriteSpeakDialogue } from '../../types';

export function sequencesBetween(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export function feedbackCounts(
  dialogue: WriteSpeakDialogue | null,
  sequences: readonly number[],
): FeedbackCounts {
  const counts = { ready: 0, pending: 0, paused: 0, unavailable: 0 };
  for (const sequence of sequences) {
    const state = dialogue?.coaching?.[sequence - 1]?.state;
    if (state === 'ready') counts.ready += 1;
    else if (state === 'pending') counts.pending += 1;
    else if (state === 'paused') counts.paused += 1;
    else counts.unavailable += 1;
  }
  return counts;
}

export function feedbackSummary(
  dialogue: WriteSpeakDialogue | null,
  sequences: readonly number[],
): string {
  if (dialogue === null) return 'Feedback status is loading.';
  const counts = feedbackCounts(dialogue, sequences);
  const states = [
    [counts.ready, 'with feedback'],
    [counts.pending, 'pending'],
    [counts.paused, 'paused'],
    [counts.unavailable, 'unavailable'],
  ] as const;
  const answers = `${sequences.length} ${sequences.length === 1 ? 'answer' : 'answers'}`;
  const shown = states.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`);
  return [answers, ...shown].join(' · ');
}

export function questionForSequence(
  dialogue: WriteSpeakDialogue | null,
  sequence: number,
  writtenEnd: number,
): string {
  if (!dialogue) return '';
  if (sequence === 1 || (sequence === writtenEnd + 1 && writtenEnd > 0)) {
    return dialogue.opening_question;
  }
  return dialogue.turns[sequence - 2]?.assistant_question ?? '';
}

export function hasSavedAnswers(
  dialogue: WriteSpeakDialogue,
  sequences: readonly number[],
): boolean {
  return sequences.some((sequence) => dialogue.turns[sequence - 1]?.learner.trim());
}

export function coachingStatusMessage(state: AnswerCoaching | undefined): string {
  if (!state) return 'Coaching status is unavailable.';
  if (state.state === 'pending') return 'Eva is still checking this answer.';
  if (state.state === 'paused') return 'Coaching is paused. You can continue.';
  if (state.state === 'failed') return 'Eva could not check this answer yet.';
  return '';
}
