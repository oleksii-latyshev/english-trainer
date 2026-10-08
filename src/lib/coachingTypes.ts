import { isTurnFeedback, type TurnFeedback } from './types';

/** Where the background coaching of one answer stands (`TurnCoaching` in Rust). */
export type TurnCoaching =
  | { state: 'pending' }
  | { state: 'paused' }
  | { state: 'failed' }
  | { state: 'ready'; feedback: TurnFeedback };

export function isTurnCoaching(value: unknown): value is TurnCoaching {
  if (typeof value !== 'object' || value === null || !('state' in value)) return false;
  switch (value.state) {
    case 'pending':
    case 'paused':
    case 'failed':
      return true;
    case 'ready':
      return 'feedback' in value && isTurnFeedback(value.feedback);
    default:
      return false;
  }
}

/** Name of the Tauri event Rust sends when coaching for a session changed. */
export const COACHING_UPDATED_EVENT = 'coaching-updated';

export type CoachingEvent = { session_id: number };

export function isCoachingEvent(value: unknown): value is CoachingEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'session_id' in value &&
    typeof value.session_id === 'number' &&
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0
  );
}
