import type { ActiveReview } from '../../types';

export type ReviewCopy = {
  readonly state: 'due' | 'resume' | 'calm';
  readonly title: string;
  readonly hint: string;
  readonly actionLabel: string | null;
};

const REVIEW_MINUTES = 2;

function waitingTitle(dueCount: number): string {
  return dueCount === 1 ? '1 item is waiting' : `${dueCount} items are waiting`;
}

export function reviewCopy(dueCount: number, active: ActiveReview): ReviewCopy {
  if (active.tag === 'saved') {
    return {
      state: 'resume',
      title: 'Spoken review in progress',
      hint: `Pick up where you left off — ${active.resolved} of ${active.total} done.`,
      actionLabel: 'Resume review',
    };
  }
  if (dueCount > 0) {
    return {
      state: 'due',
      title: waitingTitle(dueCount),
      hint: `About ${REVIEW_MINUTES} minutes. Say each one in a sentence of your own.`,
      actionLabel: 'Start spoken review',
    };
  }
  return {
    state: 'calm',
    title: 'All caught up',
    hint: 'Nothing is due. Phrases come back here when it is time to say them again.',
    actionLabel: null,
  };
}
