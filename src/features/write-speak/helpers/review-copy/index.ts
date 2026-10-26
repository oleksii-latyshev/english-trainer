import type { PracticeMode, PracticePhase } from '@/core/practice-session';

export function reviewCopy(phase: PracticePhase): { title: string; detail: string } {
  if (phase === 'writing_review') {
    return {
      title: 'Review writing',
      detail: 'Written answers and their coaching stay separate from spoken rehearsal.',
    };
  }
  return {
    title: 'Review speaking',
    detail:
      'Review written and spoken answers separately. Pending feedback is not counted as an improvement.',
  };
}

export function modeLabel(practiceMode: PracticeMode): string {
  return practiceMode === 'text_chat' ? 'Text chat' : 'Write, then speak';
}

export function originalQuestionLabel(
  isComplete: boolean,
  spokenTurnCount: number,
  writtenTurnCount: number,
): string {
  return isComplete
    ? 'Replay complete'
    : `Original question ${spokenTurnCount + 1} of ${writtenTurnCount}`;
}
