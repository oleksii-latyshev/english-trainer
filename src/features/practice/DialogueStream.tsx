import { Button } from '@heroui/react';
import { type ReactNode, useEffect, useRef } from 'react';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { buildDialogueMessages, type DialogueMessage } from './lib/dialogueMessages';

type Props = {
  dialogue: PracticeDialogue | null;
  currentQuestion?: string;
  onPlaySpeech?: (text: string) => void;
  children?: ReactNode;
  historyError?: string;
  retryHistory?: () => void;
};

function MessageBubble({
  message,
  onPlaySpeech,
}: {
  message: DialogueMessage;
  onPlaySpeech?: (text: string) => void;
}) {
  const isEva = message.sender === 'assistant';
  const fullText = message.question ? `${message.text} ${message.question}` : message.text;

  return (
    <article
      aria-label={isEva ? 'Eva says' : 'You said'}
      className={`chat-message-row ${isEva ? 'chat-message-row--eva' : 'chat-message-row--learner'}`}
    >
      <div className={`chat-bubble ${isEva ? 'chat-bubble--eva' : 'chat-bubble--learner'}`}>
        <header className="chat-bubble-header">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${isEva ? 'bg-purple-400' : 'bg-emerald-400'}`}
              aria-hidden="true"
            />
            <span className="chat-bubble-author">{isEva ? 'Eva' : 'You'}</span>
            {message.inputSource === 'text' && (
              <span className="text-xs text-zinc-400">Typed answer</span>
            )}
            {message.inputSource === 'edited' && (
              <span className="text-xs text-zinc-400">Edited transcript</span>
            )}
          </div>
          {isEva && onPlaySpeech && (
            <Button
              aria-label="Hear Eva speak this message"
              className="chat-voice-btn"
              onPress={() => onPlaySpeech(fullText)}
              size="sm"
              variant="ghost"
            >
              ◖)
            </Button>
          )}
        </header>
        <div className="chat-bubble-body">
          {message.text && <p className="chat-text">{message.text}</p>}
          {message.question && <p className="chat-question">{message.question}</p>}
        </div>
      </div>
    </article>
  );
}

export function DialogueStream({
  dialogue,
  currentQuestion,
  onPlaySpeech,
  children,
  historyError,
  retryHistory,
}: Props) {
  const messages = buildDialogueMessages(dialogue, currentQuestion);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A new message scrolls the external viewport to the latest turn.
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div
      aria-label="Conversation message history"
      className="dialogue-stream"
      role="log"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this scroll region to read older messages.
      tabIndex={0}
    >
      <div className="dialogue-stream-inner">
        {historyError && (
          <div role="alert" className="error-message">
            <p>{historyError}</p>
            <Button onPress={retryHistory} variant="secondary">
              Retry history
            </Button>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onPlaySpeech={onPlaySpeech} />
        ))}
        {children}
        <div ref={scrollEndRef} aria-hidden="true" />
      </div>
    </div>
  );
}
