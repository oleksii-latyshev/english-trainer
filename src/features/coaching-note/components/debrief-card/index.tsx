import { RegistryContext } from '@effect/atom-react';
import { Volume2 } from 'lucide-react';
import { type ReactNode, useContext } from 'react';
import { createPlayback } from '@/core/speech';
import { Button } from '@/shared/ui/button';
import type { DebriefCard } from '../../helpers/debrief-cards';
import { findingGroups, reasonLine } from '../../helpers/debrief-findings';
import { offeredWord } from '../../helpers/offered-word';
import { reviewView } from '../../helpers/review-view';
import type { DebriefWord, TurnFeedback } from '../../types';
import { AnswerReview } from '../answer-review';
import { MarkedRewrite } from '../marked-rewrite';
import { SayAgain } from '../say-again';

type Props = {
  card: DebriefCard;
  renderTake: (word: DebriefWord) => ReactNode;
};

const LABEL = 'text-caption text-faint';

function Exchange({ card }: { card: DebriefCard }) {
  return (
    <div className="flex flex-col gap-2">
      {card.question && (
        <p className="text-body text-muted leading-copy m-0 font-semibold" data-word-lookup>
          <span className="sr-only">Eva asked: </span>
          {card.question}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <span className={LABEL}>You said</span>
        <p
          className="border-accent-line bg-accent-soft text-body text-foreground leading-copy m-0 rounded-2xl border px-4.5 py-3.5 wrap-anywhere"
          data-word-lookup
        >
          {card.said}
        </p>
      </div>
    </div>
  );
}

function Findings({ feedback }: { feedback: TurnFeedback }) {
  return (
    <div className="flex flex-col gap-2.5">
      {findingGroups(feedback).map((group) => (
        <div className="flex flex-col gap-1" key={group.kind}>
          <span className={LABEL}>{group.label}</span>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {group.findings.map((finding) => (
              <li
                className="text-caption text-muted leading-copy"
                data-word-lookup
                key={`${finding.said}:${finding.better}`}
              >
                <span>“{finding.said}”</span>
                <span aria-hidden="true"> → </span>
                <span className="sr-only"> becomes </span>
                <strong className="text-foreground font-semibold">{finding.better}</strong>
                <span> · {finding.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function WordsToTake({
  feedback,
  offered,
  renderTake,
}: { feedback: TurnFeedback; offered: readonly DebriefWord[] } & Pick<Props, 'renderTake'>) {
  if (feedback.words_to_take.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>Words to take</span>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {feedback.words_to_take.map((word) => {
          const offer = offeredWord(offered, word.phrase);
          return (
            <li
              className="border-line flex items-start gap-3 rounded-xl border px-3.5 py-3"
              key={word.phrase}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body text-foreground font-semibold wrap-anywhere">
                  {word.phrase}
                </span>
                <span className="text-caption text-muted leading-copy" data-word-lookup>
                  {word.meaning}
                </span>
                <span className="text-caption text-faint leading-copy" data-word-lookup>
                  “{word.example}”
                </span>
              </div>
              {offer && renderTake(offer)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReadyBody({ card, feedback, renderTake }: Props & { feedback: TurnFeedback }) {
  const registry = useContext(RegistryContext);
  return (
    <section
      aria-label={`Review of answer ${card.target.sequence}`}
      className="border-line bg-surface flex flex-col gap-3 rounded-2xl border px-4.5 py-3.5"
    >
      <div className="flex flex-col gap-1">
        <span className={LABEL}>Better version</span>
        <MarkedRewrite rewrite={feedback.b2_rewrite} transcript={card.said} />
      </div>
      <p className="text-caption text-muted m-0" data-word-lookup>
        {reasonLine(feedback)}
      </p>
      <Findings feedback={feedback} />
      <WordsToTake feedback={feedback} offered={card.offered} renderTake={renderTake} />
      <SayAgain
        target={card.target}
        trailing={
          <Button
            onClick={() => void createPlayback(registry).play(feedback.b2_rewrite)}
            size="sm"
            tone="quiet"
          >
            <Volume2 aria-hidden="true" />
            Hear it
          </Button>
        }
      />
    </section>
  );
}

export function DebriefCardView({ card, renderTake }: Props) {
  const view = reviewView(card.coaching);
  return (
    <div className="flex flex-col gap-3">
      <Exchange card={card} />
      {view.tag === 'ready' ? (
        <ReadyBody card={card} feedback={view.feedback} renderTake={renderTake} />
      ) : (
        <AnswerReview coaching={card.coaching} target={card.target} transcript={card.said} />
      )}
    </div>
  );
}
