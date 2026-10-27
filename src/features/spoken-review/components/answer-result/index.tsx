import { useAtomValue } from '@effect/atom-react';
import { Check, Minus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { modelLineOf } from '../../helpers/model-line';
import { shownMaterialAtom } from '../../model/materials-atoms';
import { isRunFinishedAtom, sessionAtom } from '../../model/session-atoms';
import { useReviewCommands } from '../../model/use-review-commands';
import { isBusyAtom, resultViewAtom } from '../../model/view-atoms';
import { answerResult } from './styles';

export function AnswerResult() {
  const session = useAtomValue(sessionAtom);
  const view = useAtomValue(resultViewAtom);
  const material = useAtomValue(shownMaterialAtom);
  const isFinished = useAtomValue(isRunFinishedAtom);
  const isBusy = useAtomValue(isBusyAtom);
  const commands = useReviewCommands();
  if (session === null || session.step.tag !== 'result' || view === null) return null;

  const { result } = session.step;
  const model = modelLineOf(result, material?.model_answer ?? null);
  const slots = answerResult({ tone: view.tone });
  const Icon = view.tone === 'used' ? Check : Minus;

  return (
    <div className="flex flex-col gap-2.5">
      <div className={slots.bubble()}>
        {view.caption && <div className={slots.caption()}>{view.caption}</div>}
        <p className="m-0">
          {view.segments.map((segment, index) =>
            segment.isMatch ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: The segments are a fixed split of one string.
              <mark className={slots.mark()} key={index}>
                {segment.text}
              </mark>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: The segments are a fixed split of one string.
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      </div>
      <div className={slots.card()} data-outcome={view.tone} role="status">
        <div className={slots.head()}>
          <span className={slots.icon()}>
            <Icon aria-hidden="true" className="size-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className={slots.title()}>{view.title}</div>
            <div className={slots.hint()}>
              {view.hint.move && (
                <>
                  {view.hint.move.prefix}{' '}
                  <strong className="text-status-improving font-bold">
                    {view.hint.move.status}
                  </strong>
                </>
              )}
              {view.hint.text}
            </div>
          </div>
        </div>
        <div className={slots.model()}>
          <span className={slots.modelLabel()}>{model.label}</span>
          {model.text}
        </div>
        <div className={slots.actions()}>
          <Button onClick={() => commands.playExample(model.text)} size="sm" tone="quiet">
            Play example
          </Button>
          <Button disabled={isBusy} onClick={commands.practice} size="sm" tone="secondary">
            Shadow it
          </Button>
          {view.canTryAgain && (
            <Button disabled={isBusy} onClick={commands.practice} size="sm" tone="secondary">
              Try once more
            </Button>
          )}
          <Button disabled={isBusy} onClick={commands.next} size="sm" tone="primary">
            {isFinished ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
