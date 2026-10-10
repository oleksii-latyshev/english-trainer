import type { PracticeActions } from '../practiceViewModel';

/** Practice actions that also clear the previous answer's state when a new turn begins. */
export function withTurnReset(
  actions: PracticeActions,
  turn: {
    isRetrying: boolean;
    startRetry: () => void;
    resetTurnState: () => void;
    interruptReply?: (record: boolean) => Promise<void>;
  },
): PracticeActions {
  return {
    ...actions,
    startRecording: turn.isRetrying
      ? turn.startRetry
      : () => {
          if (turn.interruptReply) {
            void turn.interruptReply(true);
            return;
          }
          turn.resetTurnState();
          actions.startRecording();
        },
    pauseMic: () => {
      if (turn.interruptReply) void turn.interruptReply(false);
      actions.pauseMic();
    },
    startPractice: () => {
      turn.resetTurnState();
      actions.startPractice();
    },
  };
}
