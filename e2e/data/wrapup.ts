import type { FinishedPracticeSession } from '@/core/ipc';
import { finishedSession } from './sessions';

export function wrapupSummary(
  wrapupPreparation: FinishedPracticeSession['wrapup_preparation'],
  phrases = finishedSession.phrases,
  pendingCoaching = 0,
): FinishedPracticeSession {
  return {
    ...finishedSession,
    wrapup_preparation: wrapupPreparation,
    phrases,
    pending_coaching: pendingCoaching,
  };
}

export const phraseSet = [
  {
    sequence: 1,
    phrase: 'It saves me time.',
    note: 'Use this to explain a practical benefit.',
    you_said: 'It make my work faster.',
  },
  {
    sequence: 2,
    phrase: 'I tend to plan ahead.',
    note: 'Use tend to for a usual habit.',
    you_said: 'Usually I plan before.',
  },
  {
    sequence: 3,
    phrase: 'That gives me more room to focus.',
    note: 'Use this to describe a helpful result.',
    you_said: 'Then I have time for focus.',
  },
];
