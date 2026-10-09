import { Button } from '@heroui/react';
import { Bookmark, ChevronDown, ChevronUp, Mic, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TurnFeedback } from '@/lib/types';
import type { NoteView } from './lib/note';
import { highlightRewrite } from './lib/rewriteDiff';

export type PhraseSaveState = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  view: NoteView;
  /** What the learner said, to show which words of the rewrite changed. */
  transcript: string;
  isOpen: boolean;
  onToggle: () => void;
  phraseSaveState: PhraseSaveState;
  /** False when the phrase is too long for a Memory card. */
  canSavePhrase: boolean;
  onSavePhrase: () => void;
  onSayAgain: () => void;
  isSayAgainDisabled: boolean;
  onSpeakRewrite: (text: string) => void;
  /** Checking failed or coaching is paused: asks again. */
  onRetryCoaching: () => void;
  /** The second try, shown inside the note. */
  secondTry?: ReactNode;
};

function saveLabel(state: PhraseSaveState): string {
  switch (state) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved to Memory';
    case 'error':
      return 'Retry saving phrase';
    default:
      return 'Save phrase';
  }
}

function Rewrite({ feedback, transcript }: { feedback: TurnFeedback; transcript: string }) {
  return (
    <p className="talk-card-text" data-word-lookup>
      {highlightRewrite(transcript, feedback.b2_rewrite).map((part, index) =>
        part.isChanged ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: The runs are positional output of one rewrite.
          <mark className="talk-hl" key={index}>
            {part.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: The runs are positional output of one rewrite.
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function Focus({ feedback }: { feedback: TurnFeedback }) {
  const focus = feedback.focus_feedback[0];
  return (
    <div className="talk-focus">
      {focus ? (
        <>
          <p data-word-lookup>{focus.explanation}</p>
          <p data-word-lookup>
            You said “{focus.original}” · try “{focus.improved}”
          </p>
        </>
      ) : (
        <p>No priority correction was found for this answer.</p>
      )}
    </div>
  );
}

function ReadyNote(props: Props & { feedback: TurnFeedback }) {
  const { feedback } = props;
  if (!props.isOpen) {
    return (
      <Button className="talk-collapsed" onPress={props.onToggle} size="sm" variant="ghost">
        <span className="talk-card-label">More natural</span>
        <span className="talk-collapsed-text">{feedback.b2_rewrite}</span>
        <ChevronDown aria-hidden="true" size={14} />
      </Button>
    );
  }
  return (
    <div className="talk-card talk-note" aria-live="polite">
      <div className="talk-card-header">
        <span className="talk-card-label">More natural</span>
        <Button
          aria-label="Collapse note"
          className="ml-auto"
          isIconOnly
          onPress={props.onToggle}
          size="sm"
          variant="ghost"
        >
          <ChevronUp aria-hidden="true" size={14} />
        </Button>
      </div>
      <Rewrite feedback={feedback} transcript={props.transcript} />
      <Focus feedback={feedback} />
      {props.secondTry}
      <div className="talk-card-actions">
        <Button
          isDisabled={props.isSayAgainDisabled}
          onPress={props.onSayAgain}
          size="sm"
          variant="secondary"
        >
          <Mic aria-hidden="true" size={14} />
          Say it again
        </Button>
        {props.canSavePhrase && (
          <Button
            aria-pressed={props.phraseSaveState === 'saved'}
            isDisabled={props.phraseSaveState === 'saving'}
            onPress={props.onSavePhrase}
            size="sm"
            variant="secondary"
          >
            <Bookmark
              aria-hidden="true"
              fill={props.phraseSaveState === 'saved' ? 'currentColor' : 'none'}
              size={14}
            />
            {saveLabel(props.phraseSaveState)}
          </Button>
        )}
        <Button onPress={() => props.onSpeakRewrite(feedback.b2_rewrite)} size="sm" variant="ghost">
          <Volume2 aria-hidden="true" size={14} />
          Hear it
        </Button>
      </div>
    </div>
  );
}

/** The coaching note under the learner's answer: it appears by itself and never blocks Eva. */
export function CoachingNote(props: Props) {
  const { view } = props;
  switch (view.tag) {
    case 'checking':
      return (
        <p className="talk-quiet-note" role="status">
          <span className="talk-dots">
            <i />
            <i />
            <i />
          </span>
          Checking your answer…
        </p>
      );
    case 'paused':
      return (
        <p className="talk-quiet-note">
          Coaching is paused for now because Antigravity has no quota left. Talking is not affected.{' '}
          <Button onPress={props.onRetryCoaching} size="sm" variant="ghost">
            Try again
          </Button>
        </p>
      );
    case 'failed':
      return (
        <p className="talk-quiet-note">
          Couldn’t check this answer.{' '}
          <Button onPress={props.onRetryCoaching} size="sm" variant="ghost">
            Retry
          </Button>
        </p>
      );
    case 'ready':
      return <ReadyNote {...props} feedback={view.feedback} />;
  }
}
