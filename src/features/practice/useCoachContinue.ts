import { useState } from 'react';
import type { SessionDetails } from './lib/practiceState';
import { canContinueCoach } from './lib/practiceViewState';
import type { PracticeActions } from './practiceViewModel';
import type { useStreamingReply } from './useStreamingReply';

type Options = {
  session: SessionDetails | undefined;
  practiceTag: string;
  isBusy: boolean;
  canChangeSession: boolean;
  continueCoachTurn: PracticeActions['continueCoachTurn'];
  streamingReply: ReturnType<typeof useStreamingReply>;
  onContinued: () => void;
};

export function useCoachContinue(options: Options) {
  const { session, streamingReply } = options;
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState('');

  async function continueCoach() {
    if (
      !session?.coachState ||
      !canContinueCoach(session, {
        practiceTag: options.practiceTag,
        isBusy: options.isBusy,
        canChangeSession: options.canChangeSession,
        isContinuing,
      })
    )
      return;
    setIsContinuing(true);
    setError('');
    const sessionId = session.sessionId;
    streamingReply.begin({ sessionId });
    try {
      await options.continueCoachTurn(sessionId, session.coachState.sequence, (text) =>
        streamingReply.append(sessionId, text),
      );
      options.onContinued();
    } catch {
      setError(
        'Could not get the next Coach prompt. Your saved answer is still here; retry Continue when ready.',
      );
    } finally {
      streamingReply.clear();
      setIsContinuing(false);
    }
  }

  return { isContinuing, error, continueCoach };
}
