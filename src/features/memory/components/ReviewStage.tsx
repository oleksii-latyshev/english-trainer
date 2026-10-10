import { Button } from '@heroui/react';
import { Bookmark, Check, Minus, Volume2 } from 'lucide-react';
import { Eva, type EvaMood } from '@/components/eva/Eva';
import type { ResultView } from '@/features/memory/lib/reviewResult';
import type { ReviewPrompt } from '@/features/memory/lib/reviewTurn';
import type { WordingSegment } from '@/features/memory/lib/wordingMatch';
import type { LearningItemType, LearningStatus } from '@/lib/learningTypes';
import '@/features/memory/reviewResult.css';
import { StatusChip } from './StatusChip';

type ContextProps = {
  itemType: LearningItemType;
  /** Known only once the answer is saved; until then this is recall and the wording stays hidden. */
  target: string | null;
  status: LearningStatus | null;
};

/** What is being practised, and where that item stands. */
export function ReviewContext({ itemType, target, status }: ContextProps) {
  let label = 'Use the phrase you saved';
  if (itemType === 'mistake') label = 'Say it the better way';
  if (target !== null) label = 'The wording';
  return (
    <div className="review-context">
      <Bookmark aria-hidden="true" size={16} />
      <span className="review-context-label">{label}</span>
      {target !== null && <span className="review-context-target">{target}</span>}
      {status !== null && <StatusChip status={status} />}
    </div>
  );
}

type SituationProps = {
  prompt: ReviewPrompt;
  mood: EvaMood;
  canReplay: boolean;
  onReplay: () => void;
};

/** Eva and the situation she gives. */
export function ReviewSituation({ prompt, mood, canReplay, onReplay }: SituationProps) {
  return (
    <div className="review-situation">
      <Eva decorative mood={mood} size={140} />
      <div className="review-situation-copy">
        <div className="review-situation-label">{prompt.label}</div>
        <p className="review-situation-text">{prompt.text}</p>
        <Button
          className="review-replay"
          isDisabled={!canReplay}
          onPress={onReplay}
          size="sm"
          variant="ghost"
        >
          <Volume2 aria-hidden="true" size={14} />
          Replay
        </Button>
      </div>
    </div>
  );
}

/** The learner's words with the wording marked where it was said. */
function AnswerBubble({ segments, caption }: { segments: WordingSegment[]; caption?: string }) {
  return (
    <div className="review-answer">
      {caption && <div className="review-answer-caption">{caption}</div>}
      <p>
        {segments.map((segment, index) =>
          segment.isMatch ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: Segments are a fixed split of one string.
            <mark className="review-hl" key={index}>
              {segment.text}
            </mark>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: Segments are a fixed split of one string.
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>
    </div>
  );
}

type ResultProps = {
  view: ResultView;
  target: string;
  /** Label of the button that moves on. */
  nextLabel: string;
  isBusy: boolean;
  onNext: () => void;
  onTryAgain: () => void;
  modelAnswer: string;
  modelLabel: string;
  onPlayExample: () => void;
};

/** The answer, then "Used it" or "Not yet" with what comes next. */
export function ReviewResult({
  view,
  target,
  nextLabel,
  isBusy,
  onNext,
  onTryAgain,
  modelAnswer,
  modelLabel,
  onPlayExample,
}: ResultProps) {
  const isUsed = view.tone === 'used';
  const nextButton = (
    <Button isDisabled={isBusy} onPress={onNext} variant="primary">
      {nextLabel}
    </Button>
  );
  return (
    <div className="review-result-column">
      <AnswerBubble caption={view.caption} segments={view.segments} />
      <div className="review-result" data-outcome={view.tone} role="status">
        <div className="review-result-row">
          <span className="review-result-icon">
            {isUsed ? (
              <Check aria-hidden="true" size={16} strokeWidth={2.6} />
            ) : (
              <Minus aria-hidden="true" size={16} strokeWidth={2.4} />
            )}
          </span>
          <div className="review-result-copy">
            <div className="review-result-title">{view.title}</div>
            <div className="review-result-hint">
              {view.hint.lead && <strong>{view.hint.lead}</strong>}
              {view.hint.text}
            </div>
          </div>
        </div>
        <div className="review-model">
          <span>{modelLabel}</span>
          {modelAnswer || target}
        </div>
        <div className="review-result-actions">
          <Button onPress={onPlayExample} variant="secondary">
            Play example
          </Button>
          <Button isDisabled={isBusy} onPress={onTryAgain} variant="secondary">
            Shadow it
          </Button>
          {view.canTryAgain && (
            <Button isDisabled={isBusy} onPress={onTryAgain} variant="secondary">
              Try again
            </Button>
          )}
          {nextButton}
        </div>
      </div>
    </div>
  );
}
