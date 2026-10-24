import { ArrowDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { buildDialogueMessages, type DialogueMessage } from '../../helpers/dialogue-messages';
import { useDialogue, useReplay } from '../../model/use-dialogue';
import { useFollow } from '../../model/use-follow';
import { EvaMessage } from '../eva-message';
import { LearnerMessage } from '../learner-message';
import { Thinking } from '../thinking';

export const HISTORY_FAILED_MESSAGE = 'Could not refresh dialogue history.';

type Props = {
  currentQuestion: string | undefined;
  canReplay: boolean;
  renderNote?: (message: DialogueMessage) => ReactNode;
  children?: ReactNode;
};

export function Dialogue({ currentQuestion, canReplay, renderNote, children }: Props) {
  const { dialogue, hasFailed, pendingReply, retry } = useDialogue();
  const replay = useReplay();
  const messages = buildDialogueMessages(dialogue, currentQuestion);
  const follow = useFollow(messages.length, pendingReply);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        aria-label="Conversation message history"
        className="mask-fade-top min-h-0 flex-1 overflow-y-auto px-10 pt-24 pb-3"
        onScroll={follow.onScroll}
        ref={follow.viewportRef}
        role="log"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this scroll region to read older messages.
        tabIndex={0}
      >
        <div className="mx-auto flex w-full max-w-205 flex-col gap-5" ref={follow.contentRef}>
          {hasFailed && (
            <Notice
              className="flex items-center justify-between gap-3 rounded-control border"
              role="alert"
              tone="warn"
            >
              <span>{HISTORY_FAILED_MESSAGE}</span>
              <Button onClick={retry} size="sm" tone="secondary">
                Retry history
              </Button>
            </Notice>
          )}
          {messages.map((message) =>
            message.sender === 'assistant' ? (
              <EvaMessage
                key={message.id}
                message={message}
                onPlaySpeech={canReplay ? replay : undefined}
              />
            ) : (
              <LearnerMessage key={message.id} message={message} note={renderNote?.(message)} />
            ),
          )}
          {pendingReply === '' && <Thinking />}
          {pendingReply && (
            <EvaMessage
              isStreaming
              message={{ id: 'msg-streaming', sender: 'assistant', text: pendingReply }}
            />
          )}
          {children}
        </div>
      </div>
      {follow.hasUnseen && (
        <Button
          className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-overlay"
          onClick={follow.jumpToNewest}
          size="sm"
          tone="secondary"
        >
          <ArrowDown aria-hidden="true" className="size-4" />
          New message
        </Button>
      )}
    </div>
  );
}
