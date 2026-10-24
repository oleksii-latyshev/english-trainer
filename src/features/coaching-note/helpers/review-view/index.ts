import type { TurnCoaching, TurnFeedback } from '../../types';

export type ReviewView =
  | { readonly tag: 'pending' }
  | { readonly tag: 'paused' }
  | { readonly tag: 'failed' }
  | { readonly tag: 'ready'; readonly feedback: TurnFeedback };

export function reviewView(coaching: TurnCoaching | undefined): ReviewView {
  switch (coaching?.state) {
    case undefined:
    case 'failed':
      return { tag: 'failed' };
    case 'pending':
      return { tag: 'pending' };
    case 'paused':
      return { tag: 'paused' };
    case 'ready':
      return { tag: 'ready', feedback: coaching.feedback };
  }
}
