import { useAtomMount, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { conversationAtom, conversationUpdatesAtom } from '../../model/atoms';
import type { ReviewedAnswer, ReviewedConversation } from '../../types';
import { AnswerReview } from '../answer-review';

type Props = {
  sessionId: number;
  renderAnswerActions?: (answer: ReviewedAnswer) => ReactNode;
};

type Actions = Pick<Props, 'renderAnswerActions'>;

const CONVERSATION_FAILED_MESSAGE = 'Could not load your conversation.';

function EvaLine({ reply, question }: { reply: string; question: string }) {
  return (
    <article
      aria-label="Eva says"
      className="flex max-w-4/5 flex-col gap-1.5 rounded-2xl rounded-tl-md border border-line bg-surface-2 px-4.5 py-3.5"
    >
      {reply && (
        <p className="m-0 text-body text-eva-text leading-copy" data-word-lookup>
          {reply}
        </p>
      )}
      {question && (
        <p className="m-0 font-semibold text-body text-foreground leading-copy" data-word-lookup>
          {question}
        </p>
      )}
    </article>
  );
}

function LearnerAnswer({
  sessionId,
  conversation,
  index,
  renderAnswerActions,
}: Actions & {
  sessionId: number;
  conversation: ReviewedConversation;
  index: number;
}) {
  const text = conversation.turns[index]?.learner.trim() ?? '';
  if (text === '') return null;
  return (
    <div className="flex w-4/5 flex-col items-end gap-2 self-end">
      <article
        aria-label="You said"
        className="wrap-anywhere rounded-2xl rounded-tr-md border border-accent-line bg-accent-soft px-4.5 py-3.5 text-body text-foreground leading-copy"
        data-word-lookup
      >
        {text}
      </article>
      <div className="w-full">
        <AnswerReview
          coaching={conversation.coaching?.[index]}
          renderActions={renderAnswerActions}
          target={{ sessionId, sequence: index + 1 }}
          transcript={text}
        />
      </div>
    </div>
  );
}

function Turns({
  sessionId,
  conversation,
  renderAnswerActions,
}: Actions & {
  sessionId: number;
  conversation: ReviewedConversation;
}) {
  const opening = conversation.opening_question.trim();
  return (
    <div className="flex flex-col gap-4">
      {opening && <EvaLine question={opening} reply="" />}
      {conversation.turns.map((turn, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: A turn is identified by its place in the saved dialogue.
        <div className="flex flex-col gap-4" key={index}>
          <LearnerAnswer
            conversation={conversation}
            index={index}
            renderAnswerActions={renderAnswerActions}
            sessionId={sessionId}
          />
          <EvaLine question={turn.assistant_question.trim()} reply={turn.assistant_reply.trim()} />
        </div>
      ))}
    </div>
  );
}

export function ConversationReview({ sessionId, renderAnswerActions }: Props) {
  useAtomMount(conversationUpdatesAtom(sessionId));
  const result = useAtomValue(conversationAtom(sessionId));
  const refresh = useAtomRefresh(conversationAtom(sessionId));
  const conversation = AsyncResult.value(result);

  if (conversation._tag === 'Some') {
    return (
      <Turns
        conversation={conversation.value}
        renderAnswerActions={renderAnswerActions}
        sessionId={sessionId}
      />
    );
  }
  if (AsyncResult.isFailure(result)) {
    return (
      <Notice
        className="flex items-center justify-between gap-3 rounded-control border"
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
    <p className="m-0 text-caption text-muted" role="status">
      Loading your conversation…
    </p>
  );
}
