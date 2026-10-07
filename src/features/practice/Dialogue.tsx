import { Button } from '@heroui/react';
import { type ReactNode, useEffect, useRef } from 'react';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { buildDialogueMessages } from './lib/dialogueMessages';
import { EvaMessage, EvaThinking, LearnerMessage } from './Messages';
import { TurnNotice } from './TurnNotice';

type Props = {
  dialogue: PracticeDialogue | null;
  currentQuestion?: string;
  onPlaySpeech?: (text: string) => void;
  children?: ReactNode;
  historyError?: string;
  retryHistory?: () => void;
  /** Eva's reply while it streams in; an empty string means she is still thinking. */
  pendingReply?: string;
};

export function Dialogue({
  dialogue,
  currentQuestion,
  onPlaySpeech,
  children,
  historyError,
  retryHistory,
  pendingReply,
}: Props) {
  const messages = buildDialogueMessages(dialogue, currentQuestion);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A new message scrolls the external viewport to the latest turn.
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pendingReply]);

  return (
    <div
      aria-label="Conversation message history"
      className="talk-dialogue"
      role="log"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this scroll region to read older messages.
      tabIndex={0}
    >
      <div className="talk-dialogue-inner">
        {historyError && (
          <TurnNotice message={historyError}>
            <Button onPress={retryHistory} size="sm" variant="secondary">
              Retry history
            </Button>
          </TurnNotice>
        )}
        {messages.map((message) =>
          message.sender === 'assistant' ? (
            <EvaMessage key={message.id} message={message} onPlaySpeech={onPlaySpeech} />
          ) : (
            <LearnerMessage key={message.id} message={message} />
          ),
        )}
        {pendingReply === '' && <EvaThinking />}
        {pendingReply && <EvaMessage isStreaming message={streamingMessage(pendingReply)} />}
        {children}
        <div ref={scrollEndRef} aria-hidden="true" />
      </div>
    </div>
  );
}

function streamingMessage(text: string) {
  return { id: 'msg-streaming', sender: 'assistant' as const, text };
}
