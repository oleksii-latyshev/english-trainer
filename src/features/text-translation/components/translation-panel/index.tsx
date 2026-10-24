import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { ipcFailureMessage } from '@/core/ipc';
import {
  prepareTranslationLanguagesAtom,
  TRANSLATION_LANGUAGES,
} from '@/core/translation-settings';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { EXPLANATION_FAILED, failureView, TRANSLATION_FAILED } from '../../helpers/lookup-copy';
import { TRANSLATION_UI_ATTRIBUTE } from '../../helpers/selection-reader';
import { draftAtom, lookupAtom } from '../../model/atoms';
import {
  changeDraft,
  closePanel,
  prepareLanguages,
  retryExplanation,
  submitDraft,
} from '../../model/commands';
import type { Explanation, Lookup } from '../../types';

const TITLE_ID = 'text-translation-title';
const INPUT_ID = 'text-translation-input';
const PREPARE_FAILED = 'The languages could not be prepared. Try again.';
const PANEL_ATTRIBUTE = { [TRANSLATION_UI_ATTRIBUTE]: '' };

function languageName(code: string): string {
  return TRANSLATION_LANGUAGES.find((language) => language.value === code)?.label ?? code;
}

function ExplanationView({ explanation }: { explanation: Explanation }) {
  const registry = useContext(RegistryContext);
  if (explanation.tag === 'pending') {
    return (
      <p className="m-0 text-caption text-muted" role="status">
        Explaining in English…
      </p>
    );
  }
  if (explanation.tag === 'ready') return <p className="m-0 text-body">{explanation.text}</p>;
  return (
    <div className="flex flex-col items-start gap-2" role="status">
      <p className="m-0 text-caption text-warn-text">
        {failureView(explanation.failure, EXPLANATION_FAILED).message}
      </p>
      <Button onClick={() => retryExplanation(registry)} size="sm" tone="secondary">
        Retry English explanation
      </Button>
    </div>
  );
}

function ResultView({ lookup }: { lookup: Extract<Lookup, { tag: 'translated' }> }) {
  return (
    <section aria-live="polite" className="mt-3 flex flex-col gap-2.5">
      <p className="m-0 text-caption text-muted">
        <strong className="text-foreground">{lookup.translation.text}</strong> ·{' '}
        {languageName(lookup.translation.native_language)}
      </p>
      <p className="m-0 font-semibold text-body text-foreground">
        {lookup.translation.translation}
      </p>
      <div className="border-line border-t pt-2.5">
        <ExplanationView explanation={lookup.explanation} />
      </div>
    </section>
  );
}

function FailureView({ lookup }: { lookup: Extract<Lookup, { tag: 'failed' }> }) {
  const registry = useContext(RegistryContext);
  const prepare = useAtomValue(prepareTranslationLanguagesAtom);
  const view = failureView(lookup.failure, TRANSLATION_FAILED);
  const isPreparing = AsyncResult.isWaiting(prepare);
  return (
    <div className="mt-3 flex flex-col items-start gap-2" role="alert">
      <p className="m-0 text-caption text-warn-text leading-copy">{view.message}</p>
      {view.needsPreparation && (
        <Button
          disabled={isPreparing}
          onClick={() => prepareLanguages(registry)}
          size="sm"
          tone="secondary"
        >
          {isPreparing ? 'Preparing…' : 'Prepare languages'}
        </Button>
      )}
      {view.canRetry && (
        <Button onClick={() => submitDraft(registry)} size="sm" tone="secondary">
          Retry
        </Button>
      )}
    </div>
  );
}

function PreparationNotice() {
  const prepare = useAtomValue(prepareTranslationLanguagesAtom);
  if (AsyncResult.isWaiting(prepare)) {
    return (
      <p className="mt-3 mb-0 text-caption text-muted" role="status">
        Preparing languages…
      </p>
    );
  }
  const failure = AsyncResult.error(prepare);
  if (Option.isSome(failure)) {
    return (
      <p className="mt-3 mb-0 text-caption text-warn-text" role="alert">
        {ipcFailureMessage(failure.value, PREPARE_FAILED)}
      </p>
    );
  }
  const status = Option.getOrNull(AsyncResult.value(prepare));
  return status === null ? null : (
    <p className="mt-3 mb-0 text-caption text-muted" role="status">
      {status.message}
    </p>
  );
}

function LookupView({ lookup }: { lookup: Lookup }) {
  switch (lookup.tag) {
    case 'idle':
      return null;
    case 'translating':
      return (
        <p className="mt-3 mb-0 text-caption text-muted" role="status">
          Translating {lookup.text}…
        </p>
      );
    case 'translated':
      return <ResultView lookup={lookup} />;
    case 'failed':
      return <FailureView lookup={lookup} />;
  }
}

export function TranslationPanel() {
  const registry = useContext(RegistryContext);
  const draft = useAtomValue(draftAtom);
  const lookup = useAtomValue(lookupAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const isTranslating = lookup.tag === 'translating';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitDraft(registry);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    changeDraft(registry, event.target.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.preventDefault();
    closePanel(registry);
  }

  return (
    <section
      aria-labelledby={TITLE_ID}
      aria-modal="false"
      className="fixed right-6 bottom-16 z-81 box-border max-h-[calc(100dvh-88px)] w-[min(380px,calc(100vw-40px))] overflow-y-auto overscroll-contain rounded-card border border-line bg-panel p-4 text-caption text-foreground shadow-overlay"
      onKeyDownCapture={handleKeyDown}
      role="dialog"
      {...PANEL_ATTRIBUTE}
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h2 className="m-0 font-semibold text-body" id={TITLE_ID}>
          Translate a phrase
        </h2>
        <Button aria-label="Close translation" onClick={() => closePanel(registry)} tone="ghost">
          Close
        </Button>
      </div>
      <form onSubmit={handleSubmit}>
        <label className="mb-1.5 block text-muted" htmlFor={INPUT_ID}>
          English word or phrase
        </label>
        <div className="flex items-center gap-2">
          <Input
            autoComplete="off"
            className="w-full min-w-0 flex-1 font-sans"
            id={INPUT_ID}
            onChange={handleChange}
            ref={inputRef}
            spellCheck={false}
            value={draft}
          />
          <Button disabled={isTranslating} type="submit">
            {isTranslating ? 'Translating…' : 'Translate'}
          </Button>
        </div>
      </form>
      <LookupView lookup={lookup} />
      <PreparationNotice />
      <p className="mt-3 mb-0 text-faint text-pip leading-copy">
        Translation stays on this Mac. Conversation and practice remain in English.
      </p>
    </section>
  );
}
