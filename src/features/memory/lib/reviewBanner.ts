export type ActiveReview =
  | { tag: 'none' }
  /** A review that was started and not finished; `resolved` of `total` items are closed. */
  | { tag: 'saved'; resolved: number; total: number };

export type ReviewBannerCopy = {
  state: 'due' | 'resume' | 'calm';
  title: string;
  hint: string;
  /** Absent when there is nothing to review. */
  actionLabel: string | null;
};

/** What the spoken-review banner on Memory offers: pick up a saved review, start one, or rest. */
export function reviewBannerCopy(dueCount: number, active: ActiveReview): ReviewBannerCopy {
  if (active.tag === 'saved') {
    return {
      state: 'resume',
      title: 'Spoken review · in progress',
      hint: `Pick up where you left off — ${active.resolved} of ${active.total} done.`,
      actionLabel: 'Resume review',
    };
  }
  if (dueCount > 0) {
    return {
      state: 'due',
      title: `Spoken review · ${dueCount} due`,
      hint: 'Eva gives you a situation, you answer out loud using the phrase. Up to 6 items · about 3 minutes.',
      actionLabel: 'Review now',
    };
  }
  return {
    state: 'calm',
    title: 'Spoken review · all caught up',
    hint: 'Nothing is due. Phrases come back here when it is time to say them again.',
    actionLabel: null,
  };
}
