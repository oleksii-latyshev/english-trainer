import { RegistryContext, useAtom, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Bookmark, Check, X } from 'lucide-react';
import { useContext } from 'react';
import { Button } from '@/shared/ui/button';
import { checkingLine } from '../../helpers/checking-line';
import { isEverythingSaved, keptPhrases, phrasesToSave } from '../../helpers/phrase-selection';
import { canSavePhrases, preparationView } from '../../helpers/preparation-view';
import { savePhrasesLabel } from '../../helpers/save-label';
import {
  phraseSelectionAtom,
  retryMessageOf,
  retryPreparationAtom,
  savePhrasesAtom,
} from '../../model/atoms';
import { removeWrapupPhrase } from '../../model/controls';
import type { FinishedSession, WrapupPhrase } from '../../types';

type Props = {
  summary: FinishedSession;
};

const ERROR_TEXT = 'm-0 text-caption text-warn';
const QUIET_TEXT = 'm-0 text-caption text-muted leading-copy';

function PhraseCard(props: { phrase: WrapupPhrase; canRemove: boolean; onRemove: () => void }) {
  return (
    <div className="rounded-card border-line bg-surface flex gap-3 border px-4.5 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-[17px] font-semibold wrap-anywhere">{props.phrase.phrase}</div>
        <div className="text-control text-muted leading-copy wrap-anywhere">
          {props.phrase.note}
        </div>
        <div className="text-caption text-muted leading-copy wrap-anywhere">
          You said: “{props.phrase.you_said}”
        </div>
      </div>
      {props.canRemove && (
        <Button
          aria-label={`Remove phrase “${props.phrase.phrase}”`}
          iconOnly
          onClick={props.onRemove}
          size="sm"
          tone="quiet"
        >
          <X aria-hidden="true" size={16} strokeWidth={2} />
        </Button>
      )}
    </div>
  );
}

function RetryButton(props: { label: string; isRetrying: boolean; onRetry: () => void }) {
  return (
    <Button disabled={props.isRetrying} onClick={props.onRetry} tone="secondary">
      {props.label}
    </Button>
  );
}

function Preparation(props: {
  summary: FinishedSession;
  retryMessage: string | undefined;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const view = preparationView(props.summary, props.retryMessage);
  switch (view.tag) {
    case 'failed':
      return (
        <div className="flex flex-wrap items-center gap-2.5">
          <p className={ERROR_TEXT} role="alert">
            {view.message}
          </p>
          <RetryButton
            isRetrying={props.isRetrying}
            label="Retry phrases"
            onRetry={props.onRetry}
          />
        </div>
      );
    case 'prepare':
      return (
        <>
          {view.message && (
            <p className={ERROR_TEXT} role="alert">
              {view.message}
            </p>
          )}
          <RetryButton
            isRetrying={props.isRetrying}
            label="Prepare phrases"
            onRetry={props.onRetry}
          />
        </>
      );
    case 'error':
      return (
        <p className={ERROR_TEXT} role="alert">
          {view.message}
        </p>
      );
    case 'empty':
      return <p className={QUIET_TEXT}>{view.message}</p>;
    case 'none':
      return null;
  }
}

function SaveButton(props: {
  count: number;
  isSaved: boolean;
  isSaving: boolean;
  hasFailed: boolean;
  onSave: () => void;
}) {
  if (props.count === 0 && !props.isSaved) return null;
  const Icon = props.isSaved ? Check : Bookmark;
  return (
    <>
      <Button
        className="mt-1"
        disabled={props.isSaving || props.isSaved}
        onClick={props.onSave}
        tone="primary"
      >
        <Icon aria-hidden="true" size={16} strokeWidth={2} />
        {props.isSaved ? 'Saved to Memory' : savePhrasesLabel(props.count)}
      </Button>
      {props.hasFailed && (
        <p className={ERROR_TEXT} role="alert">
          Could not save these phrases. Please try again.
        </p>
      )}
    </>
  );
}

function settledError<A, E>(result: AsyncResult.AsyncResult<A, E>): Option.Option<E> {
  return AsyncResult.isWaiting(result) ? Option.none() : AsyncResult.error(result);
}

export function PhraseSection({ summary }: Props) {
  const registry = useContext(RegistryContext);
  const sessionId = summary.session_id;
  const selection = useAtomValue(phraseSelectionAtom(sessionId));
  const [saveResult, save] = useAtom(savePhrasesAtom(sessionId));
  const [retryResult, retry] = useAtom(retryPreparationAtom(sessionId));
  const phrases = keptPhrases(summary.phrases, selection);
  const toSave = phrasesToSave(summary.phrases, selection);
  const checking = checkingLine(summary.pending_coaching, summary.is_coaching_paused);
  const retryMessage = Option.getOrUndefined(Option.map(settledError(retryResult), retryMessageOf));

  return (
    <section aria-labelledby="wrapup-phrases" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-body m-0 font-semibold" id="wrapup-phrases">
          Phrases worth learning
        </h2>
        <span className="text-caption text-faint">{phrases.length}</span>
      </div>
      {phrases.map((item) => (
        <PhraseCard
          canRemove={!selection.saved.has(item.phrase)}
          key={item.phrase}
          onRemove={() => removeWrapupPhrase(registry, sessionId, item.phrase)}
          phrase={item}
        />
      ))}
      <Preparation
        isRetrying={AsyncResult.isWaiting(retryResult)}
        onRetry={() => retry(undefined)}
        retryMessage={retryMessage}
        summary={summary}
      />
      {checking && <p className={QUIET_TEXT}>{checking}</p>}
      {canSavePhrases(summary.wrapup_preparation) && (
        <SaveButton
          count={toSave.length}
          hasFailed={Option.isSome(settledError(saveResult))}
          isSaved={isEverythingSaved(summary.phrases, selection)}
          isSaving={AsyncResult.isWaiting(saveResult)}
          onSave={() => save(toSave)}
        />
      )}
    </section>
  );
}
