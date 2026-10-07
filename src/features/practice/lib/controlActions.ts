import type { SessionMode } from '@/lib/types';
import type { PracticeActions } from '../practiceViewModel';
import type { SessionDetails } from './practiceState';

/** Practice actions that also clear the previous answer's state when a new turn begins. */
export function withTurnReset(
  actions: PracticeActions,
  turn: {
    session?: SessionDetails;
    isRetrying: boolean;
    startRetry: () => void;
    resetTurnState: () => void;
  },
): PracticeActions {
  return {
    ...actions,
    startRecording: turn.isRetrying
      ? turn.startRetry
      : () => {
          if (turn.session?.mode === 'coach' && turn.session.coachState?.is_pending) return;
          turn.resetTurnState();
          actions.startRecording();
        },
    startPractice: (mode?: SessionMode) => {
      turn.resetTurnState();
      actions.startPractice(mode);
    },
  };
}
