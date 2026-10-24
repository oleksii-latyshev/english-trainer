import { CircleHelp } from 'lucide-react';
import { Tooltip } from '@/shared/ui/tooltip';
import { COACHING_MARKER_HINT, coachingMarker } from '../../helpers/coaching-marker';
import type { DialogueMessage } from '../../helpers/dialogue-messages';
import { formatAnswerDuration, inputSourceLabel } from '../../helpers/message-meta';

type Props = {
  message: DialogueMessage;
};

function CoachingMarker({ message }: Props) {
  const marker = coachingMarker(message.coaching);
  if (marker === undefined) return null;
  if (marker.kind === 'pending') {
    return (
      <span
        aria-label="Being checked"
        className="size-1.5 rounded-full bg-faint opacity-50"
        role="img"
      />
    );
  }
  return (
    <Tooltip content={COACHING_MARKER_HINT}>
      <span>{marker.text}</span>
    </Tooltip>
  );
}

export function LearnerMessage({ message }: Props) {
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
      <div className="flex h-5 items-center gap-2.5 pr-1 text-caption text-faint">
        {message.usedHelp && (
          <span className="inline-flex items-center gap-1">
            <CircleHelp aria-hidden="true" className="size-3" />
            used help
          </span>
        )}
        {meta && <span>{meta}</span>}
        <CoachingMarker message={message} />
      </div>
    </article>
  );
}
