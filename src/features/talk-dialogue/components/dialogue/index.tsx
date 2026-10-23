import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { buildDialogueMessages, type DialogueMessage } from '../../helpers/dialogue-messages';
import { useDialogue, useReplay } from '../../model/use-dialogue';
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
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A new message scrolls the external viewport to the latest turn.
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pendingReply]);

  return (
    <div
      aria-label="Conversation message history"
      className="min-h-0 flex-1 overflow-y-auto px-10 pt-6 pb-3"
      role="log"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this scroll region to read older messages.
      tabIndex={0}
    >
      <div className="mx-auto flex w-full max-w-205 flex-col gap-5">
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
        <div aria-hidden="true" ref={scrollEndRef} />
      </div>
    </div>
  );
}
