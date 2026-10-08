import type { PracticeActions } from '../practiceViewModel';

/** Practice actions that also clear the previous answer's state when a new turn begins. */
export function withTurnReset(
  actions: PracticeActions,
  turn: {
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
          turn.resetTurnState();
          actions.startRecording();
        },
    startPractice: () => {
      turn.resetTurnState();
      actions.startPractice();
    },
  };
}
