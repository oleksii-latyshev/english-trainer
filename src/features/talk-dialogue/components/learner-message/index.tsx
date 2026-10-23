import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DialogueMessage } from '../../helpers/dialogue-messages';
import { formatAnswerDuration, inputSourceLabel } from '../../helpers/message-meta';

type Props = {
  message: DialogueMessage;
  note?: ReactNode;
};

export function LearnerMessage({ message, note }: Props) {
  const meta = [
    inputSourceLabel(message.inputSource),
    formatAnswerDuration(message.answerDurationMs),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article aria-label="You said" className="flex w-4/5 flex-col items-end gap-2 self-end">
      <div
        className="wrap-anywhere rounded-2xl rounded-tr-md border border-accent-line bg-accent-soft px-4.5 py-3.5 text-body text-foreground leading-copy"
        data-word-lookup
      >
        {message.text}
      </div>
      {(meta || message.usedHelp) && (
        <div className="flex gap-2.5 pr-1 text-caption text-faint">
          {message.usedHelp && (
            <span className="inline-flex items-center gap-1">
              <CircleHelp aria-hidden="true" className="size-3" />
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
