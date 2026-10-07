import { Button } from '@heroui/react';
import { Bookmark, ChevronDown, ChevronUp, Mic, TriangleAlert, Volume2 } from 'lucide-react';
import { useState } from 'react';
import type { TurnFeedback } from '@/lib/types';
import { highlightRewrite } from './lib/rewriteDiff';

export type PhraseSaveState = 'idle' | 'saving' | 'saved' | 'error';

export type NoteState =
  | { tag: 'idle' }
  | { tag: 'loading' }
  | { tag: 'ready'; feedback: TurnFeedback }
  | { tag: 'error'; message: string };

type Props = {
  state: NoteState;
  transcript: string;
  isAnswerSent: boolean;
  canReview: boolean;
  isFeedbackSaved: boolean;
  phraseSaveState: PhraseSaveState;
  phraseSaveError: string | null;
  persistError: string | null;
  onReview: () => void;
  onRetryPersist: () => void;
  onSavePhrase: () => void;
  onTryAgain?: () => void;
  onSpeakRewrite?: (text: string) => void;
};

function Notice({
  message,
  action,
}: {
  message: string;
  action?: { label: string; run: () => void };
}) {
  return (
    <div className="talk-notice" role="alert">
      <TriangleAlert aria-hidden="true" size={18} />
      <span>{message}</span>
      {action && (
        <Button onPress={action.run} size="sm" variant="secondary">
          {action.label}
        </Button>
      )}
    </div>
  );
}

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

function idleHint(isAnswerSent: boolean, canReview: boolean): string | null {
  if (!canReview)
    return 'The first answer and its feedback stay anchored while you record the retry.';
  if (!isAnswerSent) return 'Send this answer to Eva first, then ask for feedback.';
  return null;
}

function NoteBody({ feedback, transcript }: { feedback: TurnFeedback; transcript: string }) {
  const focus = feedback.focus_feedback[0];
  return (
    <>
      <p className="talk-card-text">
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
      <div className="talk-focus">
        {focus ? (
          <>
            <p>{focus.explanation}</p>
            <p>
              You said “{focus.original}” · try “{focus.improved}”
            </p>
          </>
        ) : (
          <p>No priority correction was found for this answer.</p>
        )}
      </div>
    </>
  );
}

function ReadyNote(props: Props & { feedback: TurnFeedback }) {
  const { feedback } = props;
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <Button className="talk-collapsed" onPress={() => setIsOpen(true)} size="sm" variant="ghost">
        <span className="talk-card-label">More natural</span>
        <span className="talk-collapsed-text">{feedback.b2_rewrite}</span>
        <ChevronDown aria-hidden="true" size={14} />
      </Button>
    );
  }
  return (
    <div className="talk-card" aria-live="polite">
      <div className="talk-card-header">
        <span className="talk-card-label">More natural</span>
        <Button
          aria-label="Collapse note"
          className="ml-auto"
          isIconOnly
          onPress={() => setIsOpen(false)}
          size="sm"
          variant="ghost"
        >
          <ChevronUp aria-hidden="true" size={14} />
        </Button>
      </div>
      <NoteBody feedback={feedback} transcript={props.transcript} />
      <div className="talk-card-actions">
        {props.onTryAgain && props.isFeedbackSaved && (
          <Button onPress={props.onTryAgain} size="sm" variant="secondary">
            <Mic aria-hidden="true" size={14} />
            Say it again
          </Button>
        )}
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
        {props.onSpeakRewrite && (
          <Button
            onPress={() => props.onSpeakRewrite?.(feedback.b2_rewrite)}
            size="sm"
            variant="ghost"
          >
            <Volume2 aria-hidden="true" size={14} />
            Hear it
          </Button>
        )}
        <Button
          isDisabled={!props.isAnswerSent || !props.canReview}
          onPress={props.onReview}
          size="sm"
          variant="ghost"
        >
          Review again
        </Button>
      </div>
      {props.phraseSaveError && <Notice message={props.phraseSaveError} />}
      {props.persistError && (
        <Notice
          action={{ label: 'Retry save', run: props.onRetryPersist }}
          message={`Could not save feedback to memory: ${props.persistError}`}
        />
      )}
    </div>
  );
}

/** The coaching note under the learner's answer: asked for, never blocking Eva. */
export function CoachingNote(props: Props) {
  const { state } = props;
  const hint = idleHint(props.isAnswerSent, props.canReview);
  return (
    <div className="talk-aside">
      {state.tag === 'idle' && (
        <>
          {hint && <p className="talk-quiet-note">{hint}</p>}
          <Button
            isDisabled={!props.isAnswerSent || !props.canReview}
            onPress={props.onReview}
            size="sm"
            variant="secondary"
          >
            Get feedback on this answer
          </Button>
        </>
      )}
      {state.tag === 'loading' && (
        <p className="talk-quiet-note" role="status">
          <span className="talk-dots">
            <i />
            <i />
            <i />
          </span>
          Checking your answer…
        </p>
      )}
      {state.tag === 'error' && (
        <Notice action={{ label: 'Retry review', run: props.onReview }} message={state.message} />
      )}
      {state.tag === 'ready' && <ReadyNote {...props} feedback={state.feedback} />}
    </div>
  );
}
