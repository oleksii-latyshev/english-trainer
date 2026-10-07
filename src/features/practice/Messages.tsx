import { Button } from '@heroui/react';
import { Smartphone, Volume2 } from 'lucide-react';
import { EvaMini } from '@/components/eva/Eva';
import type { DialogueMessage } from './lib/dialogueMessages';
import { inputSourceLabel } from './lib/inputSource';

type EvaProps = {
  message: DialogueMessage;
  onPlaySpeech?: (text: string) => void;
  isStreaming?: boolean;
};

export function EvaMessage({ message, onPlaySpeech, isStreaming = false }: EvaProps) {
  const fullText = message.question ? `${message.text} ${message.question}` : message.text;
  return (
    <article aria-label="Eva says" className="talk-msg">
      <EvaMini />
      <div className="talk-msg-col">
        <div className="talk-bubble talk-bubble-eva">
          {message.text && (
            <p className="talk-bubble-reply">
              {message.text}
              {isStreaming && <span aria-hidden="true" className="talk-caret" />}
            </p>
          )}
          {message.question && <p className="talk-bubble-question">{message.question}</p>}
        </div>
        {!isStreaming && (
          <div className="talk-msg-meta">
            {onPlaySpeech && (
              <Button
                aria-label="Replay Eva's reply"
                className="talk-replay"
                onPress={() => onPlaySpeech(fullText)}
                size="sm"
                variant="ghost"
              >
                <Volume2 aria-hidden="true" size={14} />
                Replay
              </Button>
            )}
            {message.isBackup && (
              <span className="talk-backup">
                <Smartphone aria-hidden="true" size={11} />
                on-device
              </span>
            )}
            {message.answeredBy && <span>{message.answeredBy}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

export function EvaThinking() {
  return (
    <div className="talk-thinking">
      <EvaMini />
      <div className="talk-bubble talk-bubble-eva">
        <span aria-label="Eva is thinking" className="talk-dots" role="status">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}

export function LearnerMessage({ message }: { message: DialogueMessage }) {
  const sourceLabel = inputSourceLabel(message.inputSource);
  return (
    <article aria-label="You said" className="talk-msg-me">
      <div className="talk-bubble talk-bubble-me">{message.text}</div>
      {sourceLabel && (
        <div className="talk-marks">
          <span>{sourceLabel}</span>
        </div>
      )}
    </article>
  );
}
