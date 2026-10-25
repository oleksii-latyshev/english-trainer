import type { UsageTarget } from '../../types';

const REVIEWED_ANSWERS = 2;

export type UsageReviewInput = {
  readonly answer: UsageTarget | null;
  readonly session: {
    readonly sessionId: number;
    readonly practiceMode: string;
    readonly isMistakePractice: boolean;
  };
  readonly dialogue: {
    readonly input_sources?: readonly string[];
    readonly help_used?: readonly boolean[];
  } | null;
  readonly isBlocked: boolean;
};

function isOwnSpokenAnswer(input: UsageReviewInput, answer: UsageTarget): boolean {
  const index = answer.sequence - 1;
  return (
    answer.sessionId === input.session.sessionId &&
    input.dialogue?.input_sources?.[index] === 'voice' &&
    input.dialogue?.help_used?.[index] !== true
  );
}

export function usageReviewTarget(input: UsageReviewInput): UsageTarget | null {
  const { answer, session } = input;
  if (answer === null || input.isBlocked) return null;
  if (session.isMistakePractice || session.practiceMode !== 'voice') return null;
  if (answer.sequence > REVIEWED_ANSWERS) return null;
  return isOwnSpokenAnswer(input, answer) ? answer : null;
}
