import type { AnswerTarget } from '../../types';

export function answerKey(target: AnswerTarget): string {
  return `${target.sessionId}:${target.sequence}`;
}
