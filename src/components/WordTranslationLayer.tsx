import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { prepareTranslationLanguages, translateWord } from '@/lib/translationApi';
import { isCurrentTranslationResult } from '@/lib/translationRequest';
import {
  isTranslationError,
  normalizeEnglishWord,
  type TranslationError,
  type TranslationStatus,
} from '@/lib/translationTypes';
import { type LookupState, WordTranslationPanel } from './WordTranslationPanel';
import { readWordSelection, type WordSelection } from './wordTranslationSelection';
import './wordTranslation.css';

const ENABLED_PATHS = new Set(['/conversation', '/memory', '/memory/review', '/summary']);
const FALLBACK_ERROR: TranslationError = {
  code: 'unavailable',
  message: 'The word could not be translated. Check availability and try again.',
};

function friendlyError(cause: unknown): TranslationError {
  return isTranslationError(cause) ? cause : FALLBACK_ERROR;
}

export function WordTranslationLayer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isEnabled = ENABLED_PATHS.has(pathname);
  const [selection, setSelection] = useState<WordSelection>();
  const [isOpen, setIsOpen] = useState(false);
  const [word, setWord] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ tag: 'idle' });
  const [statusNotice, setStatusNotice] = useState<TranslationStatus>();
  const [isPreparing, setIsPreparing] = useState(false);
  const generation = useRef(0);
  const panelIsOpen = useRef(false);
  const prepareInFlight = useRef(false);
  const prepareToken = useRef(0);

  useEffect(() => {
    function refreshSelection() {
      if (isEnabled && !panelIsOpen.current) setSelection(readWordSelection());
    }
    document.addEventListener('selectionchange', refreshSelection);
    document.addEventListener('mouseup', refreshSelection);
    document.addEventListener('keyup', refreshSelection);
    return () => {
      document.removeEventListener('selectionchange', refreshSelection);
      document.removeEventListener('mouseup', refreshSelection);
      document.removeEventListener('keyup', refreshSelection);
    };
  }, [isEnabled]);

  // Route changes invalidate in-flight work even though the effect does not read the pathname value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: This effect is the route invalidation boundary.
  useEffect(() => {
    generation.current += 1;
    panelIsOpen.current = false;
    prepareToken.current += 1;
    prepareInFlight.current = false;
    setSelection(undefined);
    setIsOpen(false);
    setIsPreparing(false);
    setLookup({ tag: 'idle' });
    setStatusNotice(undefined);
    return () => {
      generation.current += 1;
      panelIsOpen.current = false;
      prepareToken.current += 1;
    };
  }, [pathname]);

  function openPanel(initialWord = '', initialSelection?: WordSelection) {
    generation.current += 1;
    panelIsOpen.current = true;
    setWord(initialWord);
    setSelection(initialSelection);
    setLookup({ tag: 'idle' });
    setIsOpen(true);
    setStatusNotice(undefined);
  }

  function closePanel() {
    generation.current += 1;
    panelIsOpen.current = false;
    prepareToken.current += 1;
    prepareInFlight.current = false;
    setIsPreparing(false);
    setIsOpen(false);
    setSelection(undefined);
    setLookup({ tag: 'idle' });
    setStatusNotice(undefined);
  }

  function isCurrentPanelRequest(requestId: number, requestPath: string): boolean {
    return requestId === generation.current && panelIsOpen.current && requestPath === pathname;
  }

  async function submit(enteredWord: string, selected = selection) {
    const normalized = normalizeEnglishWord(enteredWord);
    if (!normalized) {
      setLookup({
        tag: 'error',
        error: { code: 'invalid_request', message: 'Enter one English word, up to 64 letters.' },
      });
      return;
    }
    const context =
      selected?.word.toLowerCase() === normalized.toLowerCase() ? selected.context : '';
    const requestId = ++generation.current;
    const requestPath = pathname;
    setWord(normalized);
    setLookup({ tag: 'loading', word: normalized });
    setStatusNotice(undefined);
    try {
      const result = await translateWord({ word: normalized, context });
      const isCurrent = isCurrentTranslationResult({
        requestId,
        currentId: generation.current,
        isPanelOpen: panelIsOpen.current,
        requestPath,
        currentPath: pathname,
        resultWord: result.word,
        requestedWord: normalized,
      });
      if (isCurrent) setLookup({ tag: 'ready', result });
    } catch (cause) {
      if (isCurrentPanelRequest(requestId, requestPath)) {
        setLookup({ tag: 'error', error: friendlyError(cause) });
      }
    }
  }

  async function prepareLanguages() {
    if (prepareInFlight.current) return;
    prepareInFlight.current = true;
    setIsPreparing(true);
    const prepareId = ++prepareToken.current;
    const requestId = ++generation.current;
    const requestPath = pathname;
    setStatusNotice(undefined);
    try {
      const status = await prepareTranslationLanguages();
      if (isCurrentPanelRequest(requestId, requestPath)) {
        setStatusNotice(status);
        setLookup({ tag: 'idle' });
      }
    } catch (cause) {
      if (isCurrentPanelRequest(requestId, requestPath)) {
        setLookup({ tag: 'error', error: friendlyError(cause) });
      }
    } finally {
      if (prepareId === prepareToken.current) {
        prepareInFlight.current = false;
        if (panelIsOpen.current) setIsPreparing(false);
      }
    }
  }

  function handleWordValueChange(value: string) {
    generation.current += 1;
    setWord(value);
    setLookup({ tag: 'idle' });
    setStatusNotice(undefined);
  }

  function handleRetry() {
    void submit(word);
  }

  if (!isEnabled) return null;

  return (
    <>
      {selection && !isOpen && (
        <button
          className="word-translation-action"
          data-word-translation-ui
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            openPanel(selection.word, selection);
            void submit(selection.word, selection);
          }}
          style={{ left: selection.point.left, top: selection.point.top }}
          type="button"
        >
          Translate “{selection.word}”
        </button>
      )}
      <button
        className="word-translation-launch"
        data-word-translation-ui
        onClick={() => openPanel()}
        type="button"
      >
        Translate a word
      </button>
      {isOpen && (
        <WordTranslationPanel
          isPreparing={isPreparing}
          lookup={lookup}
          onClose={closePanel}
          onPrepare={() => void prepareLanguages()}
          onRetry={handleRetry}
          onSubmit={() => void submit(word)}
          onWordChange={handleWordValueChange}
          statusNotice={statusNotice}
          word={word}
        />
      )}
    </>
  );
}
