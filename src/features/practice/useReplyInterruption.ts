import { type MutableRefObject, useRef } from 'react';
import { cancelPracticeReply } from './sessionApi';

type Options = {
  generation: MutableRefObject<number>;
  pending: MutableRefObject<boolean>;
  sessionId?: number;
  stopSpeech: () => void;
  isSpeaking: boolean;
  cancelPlayback: () => void;
  resetTurnState: () => void;
  resetFollowUp: () => void;
  startRecording: (discardPreRoll?: boolean) => void;
  onPendingChange: (isPending: boolean) => void;
  onError: (cause: unknown) => void;
};

export function useReplyInterruption(options: Options) {
  const interrupting = useRef(false);
  const cancelPending = async () => {
    if (options.pending.current && options.sessionId !== undefined)
      await cancelPracticeReply(options.sessionId);
  };
  return async (record: boolean, retainPreRoll = false) => {
    if (interrupting.current) return;
    interrupting.current = true;
    const generation = ++options.generation.current;
    options.cancelPlayback();
    options.stopSpeech();
    try {
      await cancelPending();
      if (generation !== options.generation.current) return;
      options.pending.current = false;
      options.onPendingChange(false);
      options.resetTurnState();
      options.resetFollowUp();
      // Manual interruption excludes Eva from pre-roll; AEC-gated voice interruption retains the first syllable.
      if (record) options.startRecording(options.isSpeaking && !retainPreRoll);
    } catch (cause) {
      if (generation === options.generation.current) options.onError(cause);
    } finally {
      interrupting.current = false;
    }
  };
}
