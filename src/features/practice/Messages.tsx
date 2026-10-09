import { Button } from '@heroui/react';
import { CircleHelp, Smartphone, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EvaMini } from '@/components/eva/Eva';
import type { DialogueMessage } from './lib/dialogueMessages';
import { inputSourceLabel } from './lib/inputSource';
import { formatAnswerDuration, formatReplyTime } from './lib/messageMeta';

type EvaProps = {
  message: DialogueMessage;
  onPlaySpeech?: (text: string) => void;
  isStreaming?: boolean;
};

export function EvaMessage({ message, onPlaySpeech, isStreaming = false }: EvaProps) {
  const evaMeta = [message.answeredBy, formatReplyTime(message.replyMs)]
    .filter(Boolean)
    .join(' · ');
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
            {evaMeta && <span>{evaMeta}</span>}
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

type LearnerProps = {
  message: DialogueMessage;
  /** The coaching note under the answer. */
  note?: ReactNode;
};

export function LearnerMessage({ message, note }: LearnerProps) {
  const sourceLabel = inputSourceLabel(message.inputSource);
  const duration = formatAnswerDuration(message.answerDurationMs);
  const meta = [sourceLabel, duration].filter(Boolean).join(' · ');
  return (
    <article aria-label="You said" className="talk-msg-me">
      <div className="talk-bubble talk-bubble-me">{message.text}</div>
      {(meta || message.usedHelp) && (
        <div className="talk-marks">
          {message.usedHelp && (
            <span className="talk-mark-help">
              <CircleHelp aria-hidden="true" size={12} />
              used help
            </span>
          )}
          {meta && <span>{meta}</span>}
        </div>
      )}
      {note}
    </article>
  );
}

/** What speech recognition has heard so far, while the learner is still speaking. */
export function LiveTranscriptBubble({ text }: { text: string }) {
  return (
    <article aria-label="Live transcript" className="talk-msg-me">
      <div className="talk-bubble talk-bubble-me talk-bubble-live">
        {text}
        <span aria-hidden="true" className="talk-caret talk-caret-me" />
      </div>
      <div className="talk-marks">
        <span>Live transcript</span>
      </div>
    </article>
  );
}
