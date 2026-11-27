import { useAtom, useAtomMount, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { ProgressBar } from '@/shared/ui/progress-bar';
import { debriefCards } from '../../helpers/debrief-cards';
import {
  isSummary,
  nextLabel,
  nextStep,
  previousStep,
  progressLabel,
} from '../../helpers/debrief-steps';
import { takenLine } from '../../helpers/taken-line';
import { conversationAtom, conversationUpdatesAtom, debriefStepAtom } from '../../model/atoms';
import type { DebriefWord, ReviewedConversation, RuleKey } from '../../types';
import { DebriefCardView } from '../debrief-card';
import { DebriefSummary } from '../debrief-summary';

type Props = {
  sessionId: number;
  isTaken: (word: DebriefWord) => boolean;
  renderTake: (word: DebriefWord) => ReactNode;
  isStartingRun: boolean;
  onPractiseRule: (ruleKey: RuleKey) => void;
};

const CONVERSATION_FAILED_MESSAGE = 'Could not load your conversation.';

function Walk({
  sessionId,
  conversation,
  isTaken,
  renderTake,
  isStartingRun,
  onPractiseRule,
}: Props & { conversation: ReviewedConversation }) {
  const [step, setStep] = useAtom(debriefStepAtom(sessionId));
  const cards = debriefCards(conversation);
  const card = cards[step];

  if (cards.length === 0) {
    return <p className="text-caption text-muted m-0">There were no answers to look at.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {card && !isSummary(step, cards.length) ? (
        <>
          <div className="flex items-center gap-3">
            <span className="text-caption text-faint shrink-0" role="status">
              {progressLabel(step, cards.length)}
            </span>
            <ProgressBar
              className="min-w-0 flex-1"
              label="Debrief progress"
              max={cards.length}
              value={step + 1}
            />
            {conversation.debrief_words.length > 0 && (
              <span className="text-caption text-faint shrink-0">
                {takenLine(
                  conversation.debrief_words.filter(isTaken).length,
                  conversation.debrief_words.length,
                )}
              </span>
            )}
          </div>
          <DebriefCardView card={card} key={card.target.sequence} renderTake={renderTake} />
        </>
      ) : (
        <DebriefSummary
          focusRule={conversation.focus_rule}
          habits={conversation.habits}
          isStartingRun={isStartingRun}
          isTaken={isTaken}
          onPractiseRule={onPractiseRule}
          wins={conversation.debrief_wins}
          words={conversation.debrief_words}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <Button disabled={step === 0} onClick={() => setStep(previousStep(step))} tone="secondary">
          Back
        </Button>
        {!isSummary(step, cards.length) && (
          <Button onClick={() => setStep(nextStep(step, cards.length))} tone="primary">
            {nextLabel(step, cards.length)}
          </Button>
        )}
      </div>
    </div>
  );
}

export function Debrief(props: Props) {
  const { sessionId } = props;
  useAtomMount(conversationUpdatesAtom(sessionId));
  const result = useAtomValue(conversationAtom(sessionId));
  const refresh = useAtomRefresh(conversationAtom(sessionId));
  const conversation = AsyncResult.value(result);

  if (conversation._tag === 'Some') return <Walk {...props} conversation={conversation.value} />;
  if (AsyncResult.isFailure(result)) {
    return (
      <Notice
        className="rounded-control flex items-center justify-between gap-3 border"
        role="alert"
        tone="warn"
      >
        <span>{CONVERSATION_FAILED_MESSAGE}</span>
        <Button onClick={refresh} size="sm" tone="secondary">
          Retry
        </Button>
      </Notice>
    );
  }
  return (
    <p className="text-caption text-muted m-0" role="status">
      Loading your conversation…
    </p>
  );
}
