import { Smartphone, Volume2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { DialogueMessage } from '../../helpers/dialogue-messages';
import { formatReplyTime } from '../../helpers/message-meta';

type Props = {
  message: DialogueMessage;
  onPlaySpeech?: (text: string) => void;
  isStreaming?: boolean;
};

const CARET =
  'ml-0.5 inline-block h-4 w-0.5 translate-y-0.75 animate-pulse motion-reduce:animate-none bg-accent';

export function EvaMessage({ message, onPlaySpeech, isStreaming = false }: Props) {
  const meta = [message.answeredBy, formatReplyTime(message.replyMs)].filter(Boolean).join(' · ');
  const fullText = message.question ? `${message.text} ${message.question}` : message.text;
  const lookup = isStreaming ? undefined : '';
  return (
    <article aria-label="Eva says" className="flex max-w-4/5 items-start gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="border-line bg-surface-2 backdrop-blur-glass rounded-2xl rounded-tl-md border px-4.5 py-3.5">
          {message.text && (
            <p
              className="text-body text-eva-text leading-copy first:last:text-foreground m-0 first:last:font-semibold"
              data-word-lookup={lookup}
            >
              {message.text}
              {isStreaming && <span aria-hidden="true" className={CARET} />}
            </p>
          )}
          {message.question && (
            <p
              className="text-body text-foreground leading-copy mt-1.5 mb-0 font-semibold"
              data-word-lookup={lookup}
            >
              {message.question}
            </p>
          )}
        </div>
        {!isStreaming && (
          <div className="text-caption text-faint flex items-center gap-2 pl-1">
            {onPlaySpeech && (
              <Button
                aria-label="Replay Eva's reply"
                onClick={() => onPlaySpeech(fullText)}
                size="sm"
                tone="quiet"
              >
                <Volume2 aria-hidden="true" />
                Replay
              </Button>
            )}
            {message.isBackup && (
              <span className="border-line inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                <Smartphone aria-hidden="true" className="size-3" />
                on-device
              </span>
            )}
            {meta && <span>{meta}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
