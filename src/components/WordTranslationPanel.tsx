import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useRef } from 'react';
import {
  TRANSLATION_LANGUAGES,
  type TranslationError,
  type TranslationStatus,
  type WordTranslation,
} from '@/lib/translationTypes';

export type LookupState =
  | { tag: 'idle' }
  | { tag: 'loading'; word: string }
  | { tag: 'ready'; result: WordTranslation }
  | { tag: 'error'; error: TranslationError };

type Props = {
  word: string;
  lookup: LookupState;
  statusNotice?: TranslationStatus;
  isPreparing: boolean;
  onWordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onPrepare: () => void;
};

function languageName(code: string): string {
  return TRANSLATION_LANGUAGES.find((language) => language.code === code)?.name ?? code;
}

export function WordTranslationPanel({
  word,
  lookup,
  statusNotice,
  isPreparing,
  onWordChange,
  onClose,
  onSubmit,
  onRetry,
  onPrepare,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    onWordChange(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    event.preventDefault();
    onClose();
  }

  return (
    <div
      aria-labelledby="word-translation-title"
      aria-modal="false"
      className="word-translation-panel"
      data-word-translation-ui
      onKeyDownCapture={handleKeyDown}
      role="dialog"
    >
      <div className="word-translation-header">
        <h2 id="word-translation-title">Translate a word</h2>
        <button aria-label="Close translation" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="translation-word">English word</label>
        <div className="word-translation-form-row">
          <input
            autoComplete="off"
            id="translation-word"
            maxLength={64}
            onChange={handleChange}
            ref={inputRef}
            spellCheck={false}
            value={word}
          />
          <button disabled={lookup.tag === 'loading'} type="submit">
            {lookup.tag === 'loading' ? 'Translating…' : 'Translate'}
          </button>
        </div>
      </form>
      {lookup.tag === 'loading' && <p role="status">Translating {lookup.word}…</p>}
      {lookup.tag === 'ready' && (
        <section aria-live="polite" className="word-translation-result">
          <p>
            <strong>{lookup.result.word}</strong> · {languageName(lookup.result.native_language)}
          </p>
          <p>{lookup.result.translation}</p>
          {lookup.result.english_explanation && <p>{lookup.result.english_explanation}</p>}
          {lookup.result.explanation_error && (
            <div className="word-translation-error" role="status">
              <p>{lookup.result.explanation_error}</p>
              <button onClick={onRetry} type="button">
                Retry English explanation
              </button>
            </div>
          )}
        </section>
      )}
      {lookup.tag === 'error' && (
        <div className="word-translation-error" role="alert">
          <p>{lookup.error.message}</p>
          {lookup.error.code === 'download_required' && (
            <button disabled={isPreparing} onClick={onPrepare} type="button">
              {isPreparing ? 'Preparing…' : 'Prepare languages'}
            </button>
          )}
          {lookup.error.code !== 'download_required' && lookup.error.code !== 'invalid_request' && (
            <button onClick={onRetry} type="button">
              Retry
            </button>
          )}
        </div>
      )}
      {statusNotice && (
        <p className="word-translation-status" role="status">
          {statusNotice.message}
        </p>
      )}
      <p className="word-translation-footnote">
        Translation stays on this Mac. Conversation and practice remain in English.
      </p>
    </div>
  );
}
