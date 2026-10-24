import type { TurnCoaching } from '../../types';

export type CoachingMarker =
  | { readonly kind: 'pending' }
  | { readonly kind: 'label'; readonly text: string };

export const COACHING_MARKER_HINT = 'Reviewed after the conversation';

function tipLabel(count: number): string {
  if (count === 0) return 'Looks good';
  return count === 1 ? '1 tip' : `${count} tips`;
}

export function coachingMarker(coaching: TurnCoaching | undefined): CoachingMarker | undefined {
  switch (coaching?.state) {
    case 'pending':
      return { kind: 'pending' };
    case 'ready':
      return { kind: 'label', text: tipLabel(coaching.feedback.focus_feedback.length) };
    default:
      return undefined;
  }
}
