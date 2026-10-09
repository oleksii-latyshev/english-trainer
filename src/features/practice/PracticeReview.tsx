import { Button } from '@heroui/react';
import type { TurnCoaching } from '@/lib/coachingTypes';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import type { PracticePhase } from '@/lib/practiceOptions';
import type { NoteTools } from './AnswerNote';
import { AnswerNote } from './AnswerNote';
import type { SessionDetails } from './lib/practiceState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import './practiceReview.css';

type Props = {
  session: SessionDetails;
  dialogue: PracticeDialogue | null;
  historyError: string;
  model: PracticeViewModel;
  actions: PracticeActions;
  noteTools: NoteTools | null;
  onRetryHistory: () => void;
};

function CoachingStatus({ state }: { state: TurnCoaching | undefined }) {
  if (!state) return <p className="practice-review-pending">Coaching status is unavailable.</p>;
  if (state.state === 'pending')
    return <p className="practice-review-pending">Eva is still checking this answer.</p>;
  if (state.state === 'paused')
    return <p className="practice-review-pending">Coaching is paused. You can continue.</p>;
  if (state.state === 'failed')
    return <p className="practice-review-pending">Eva could not check this answer yet.</p>;
  return null;
}

function AnswerCard({
  sequence,
  label,
  question,
  dialogue,
  noteTools,
}: {
  sequence: number;
  label: string;
  question: string;
  dialogue: PracticeDialogue | null;
  noteTools: NoteTools | null;
}) {
  const index = sequence - 1;
  const turn = dialogue?.turns[index];
  if (!turn?.learner.trim()) return null;
  const coaching = dialogue?.coaching?.[index];
  const olderPausedFeedback =
    coaching?.state === 'paused' && noteTools?.latestPausedSequence !== sequence;
  return (
    <article className="practice-review-answer">
      <div className="practice-review-answer-label">{label}</div>
      {question && <p className="practice-review-question">{question}</p>}
      <p className="practice-review-answer-text">{turn.learner}</p>
      {olderPausedFeedback ? (
        <CoachingStatus state={coaching} />
      ) : coaching && noteTools ? (
        <AnswerNote
          coaching={coaching}
          isPinnedOpen
          sequence={sequence}
          tools={noteTools}
          transcript={turn.learner}
        />
      ) : (
        <CoachingStatus state={coaching} />
      )}
    </article>
  );
}

function AnswerRange({
  title,
  start,
  end,
  label,
  dialogue,
  noteTools,
  writtenEnd,
}: {
  title: string;
  start: number;
  end: number;
  label: (sequence: number) => string;
  dialogue: PracticeDialogue | null;
  noteTools: NoteTools | null;
  writtenEnd: number;
}) {
  const sequences = Array.from(
    { length: Math.max(0, end - start + 1) },
    (_, index) => start + index,
  );
  const feedbackCounts = sequences.reduce(
    (counts, sequence) => {
      const state = dialogue?.coaching?.[sequence - 1]?.state;
      if (state === 'ready') counts.ready += 1;
      else if (state === 'pending') counts.pending += 1;
      else if (state === 'paused') counts.paused += 1;
      else counts.unavailable += 1;
      return counts;
    },
    { ready: 0, pending: 0, paused: 0, unavailable: 0 },
  );
  return (
    <section aria-label={title} className="practice-review-section">
      <h2>
        {title} ({start}–{end})
      </h2>
      <p className="practice-review-pending" aria-live="polite">
        {dialogue === null
          ? 'Feedback status is loading.'
          : `${sequences.length} answers · ${feedbackCounts.ready} with feedback · ${feedbackCounts.pending} pending · ${feedbackCounts.paused} paused · ${feedbackCounts.unavailable} unavailable`}
      </p>
      {sequences.map((sequence) => (
        <AnswerCard
          dialogue={dialogue}
          key={sequence}
          label={label(sequence)}
          question={questionForSequence(dialogue, sequence, writtenEnd)}
          noteTools={noteTools}
          sequence={sequence}
        />
      ))}
      {dialogue && sequences.every((sequence) => !dialogue.turns[sequence - 1]?.learner.trim()) && (
        <p className="practice-review-pending">
          These answers are not available in the saved dialogue.
        </p>
      )}
    </section>
  );
}

function questionForSequence(
  dialogue: PracticeDialogue | null,
  sequence: number,
  writtenEnd: number,
): string {
  if (!dialogue) return '';
  if (sequence === 1 || (sequence === writtenEnd + 1 && writtenEnd > 0)) {
    return dialogue.opening_question;
  }
  return dialogue.turns[sequence - 2]?.assistant_question ?? '';
}

function phaseCopy(phase: PracticePhase): { title: string; detail: string } {
  if (phase === 'writing_review') {
    return {
      title: 'Review writing',
      detail: 'Written answers and their coaching stay separate from spoken rehearsal.',
    };
  }
  return {
    title: 'Review speaking',
    detail:
      'Review written and spoken answers separately. Pending feedback is not counted as an improvement.',
  };
}

export function PracticeReview({
  session,
  dialogue,
  historyError,
  model,
  actions,
  noteTools,
  onRetryHistory,
}: Props) {
  const copy = phaseCopy(session.practicePhase);
  const isWritingReview = session.practicePhase === 'writing_review';
  const hasWritten = session.writtenTurnCount > 0;
  const writtenStart = 1;
  const writtenEnd = session.writtenTurnCount;
  const spokenStart = writtenEnd + 1;
  const spokenEnd = writtenEnd + session.spokenTurnCount;
  const canMoveToSpeaking = isWritingReview && session.practiceMode === 'write_then_speak';
  const isRetrying = noteTools !== null && noteTools.secondTrySequence !== null;

  return (
    <section aria-label={copy.title} className="practice-review">
      <header className="practice-review-header">
        <div>
          <p className="practice-review-kicker">
            {session.topicLabel} ·{' '}
            {session.practiceMode === 'text_chat' ? 'Text chat' : 'Write, then speak'}
          </p>
          <h1>{copy.title}</h1>
          <p>{copy.detail}</p>
        </div>
        <Button
          isDisabled={
            model.busy || !model.canChangeSession || model.practice.tag !== 'active' || isRetrying
          }
          onPress={actions.finishPractice}
          variant="secondary"
        >
          Finish
        </Button>
      </header>

      {model.practiceError && (
        <p className="practice-review-error" role="alert">
          {model.practiceError}
        </p>
      )}
      {historyError && (
        <div className="practice-review-error" role="alert">
          <span>{historyError}</span>
          <Button onPress={onRetryHistory} size="sm" variant="secondary">
            Retry history
          </Button>
        </div>
      )}

      <div className="practice-review-lists">
        {hasWritten && (
          <AnswerRange
            dialogue={dialogue}
            end={writtenEnd}
            label={(sequence) => `Written answer ${sequence}`}
            noteTools={noteTools}
            start={writtenStart}
            title="Written answers"
            writtenEnd={writtenEnd}
          />
        )}
        {!isWritingReview && session.spokenTurnCount > 0 && (
          <AnswerRange
            dialogue={dialogue}
            end={spokenEnd}
            label={(sequence) => `Spoken answer ${sequence - writtenEnd}`}
            noteTools={noteTools}
            start={spokenStart}
            title="Spoken answers"
            writtenEnd={writtenEnd}
          />
        )}
      </div>

      {canMoveToSpeaking && (
        <div className="practice-review-next">
          <Button
            isDisabled={
              model.busy || !model.canChangeSession || model.practice.tag !== 'active' || isRetrying
            }
            onPress={() => actions.transitionPracticePhase('speaking')}
            variant="primary"
          >
            Ready to speak
          </Button>
          <p>Eva will ask the same questions in order. The microphone opens when you continue.</p>
        </div>
      )}
      {dialogue === null && !historyError && (
        <p className="practice-review-pending">Loading saved answers…</p>
      )}
      {!hasWritten && <p className="practice-review-pending">No written answers were saved.</p>}
    </section>
  );
}
