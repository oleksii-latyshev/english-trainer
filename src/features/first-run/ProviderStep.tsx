import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Exit, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { aiSettingsAtom, aiSettingsErrorMessage, updateAiSettingsAtom } from '@/core/ai-settings';
import {
  geminiKeyDraftAtom,
  geminiKeyFailureAtom,
  geminiKeyIsBusyAtom,
  geminiKeyStatusAtom,
  keyErrorMessage,
  keySourceLabel,
  saveGeminiKeyAtom,
} from '@/features/gemini-key';
import { openExternal } from '@/lib/openExternal';
import { isProviderError } from '@/lib/types';
import { measureFirstWords } from './lib/providerSample';

const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey';

type FirstWords =
  | { tag: 'none' }
  | { tag: 'checking' }
  | { tag: 'done'; ms: number }
  | { tag: 'failed'; message: string };

function messageOf(error: unknown, fallback: string): string {
  if (isProviderError(error)) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

function GeminiKeySetup() {
  const [firstWords, setFirstWords] = useState<FirstWords>({ tag: 'none' });
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  // A key that was just saved proves itself: one real reply gives the first-words time.
  async function checkFirstWords() {
    const request = ++generation.current;
    setFirstWords({ tag: 'checking' });
    try {
      const ms = await measureFirstWords();
      if (request === generation.current) {
        setFirstWords(ms === undefined ? { tag: 'none' } : { tag: 'done', ms });
      }
    } catch (error) {
      if (request === generation.current) {
        setFirstWords({
          tag: 'failed',
          message: messageOf(error, 'The test reply failed. Check the key and your connection.'),
        });
      }
    }
  }

  const statusResult = useAtomValue(geminiKeyStatusAtom);
  const failure = useAtomValue(geminiKeyFailureAtom);
  const isWorking = useAtomValue(geminiKeyIsBusyAtom);
  const [draftKey, setDraftKey] = useAtom(geminiKeyDraftAtom);
  const saveKey = useAtomSet(saveGeminiKeyAtom, { mode: 'promiseExit' });
  const status = Option.getOrNull(AsyncResult.value(statusResult));
  const configured = status?.configured === true;

  async function save() {
    const exit = await saveKey(draftKey);
    if (Exit.isSuccess(exit)) void checkFirstWords();
  }

  return (
    <section aria-label="Gemini API key" className="first-run-card">
      <div className="first-run-key-head">
        <label className="first-run-label" htmlFor="first-run-key">
          Gemini API key
        </label>
        <a
          className="first-run-link"
          href={GEMINI_KEY_URL}
          onClick={(event) => {
            event.preventDefault();
            void openExternal(GEMINI_KEY_URL).catch(() => {
              // The link stays visible; the learner can open it from their own browser.
            });
          }}
          rel="noreferrer"
          target="_blank"
        >
          Get a free key
        </a>
      </div>
      <form
        className="first-run-key-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          autoComplete="off"
          className="first-run-field"
          disabled={isWorking}
          id="first-run-key"
          onChange={(event) => {
            const value = event.target.value;
            setDraftKey(value);
          }}
          placeholder={configured ? '••••••••••••••••' : 'Paste your key'}
          spellCheck={false}
          type="password"
          value={draftKey}
        />
        <button
          className="first-run-button"
          disabled={isWorking || draftKey.trim().length === 0}
          type="submit"
        >
          {isWorking ? 'Saving…' : configured ? 'Replace key' : 'Save key'}
        </button>
      </form>
      {configured && (
        <div className="first-run-ok" role="status">
          <Check aria-hidden="true" size={14} strokeWidth={2.4} />
          {status.source !== null && keySourceLabel(status.source)}
          {firstWords.tag === 'checking' && ' · checking a reply…'}
          {firstWords.tag === 'done' && ` · first words in ${(firstWords.ms / 1000).toFixed(1)} s`}
        </div>
      )}
      {firstWords.tag === 'failed' && (
        <p className="first-run-alert" role="alert">
          {firstWords.message}
        </p>
      )}
      {Option.isSome(failure) && (
        <p className="first-run-alert" role="alert">
          {keyErrorMessage(failure.value)}
        </p>
      )}
      {!AsyncResult.isInitial(statusResult) && !configured && (
        <p className="first-run-hint">
          Eva cannot reply with Gemini until a key is saved. Add one, or choose Apple on-device.
        </p>
      )}
      <p className="first-run-note">
        On the free tier, Google may use what you send to improve its models. Practice text only —
        never audio.
      </p>
    </section>
  );
}

/** Step 2: the conversation provider, saved the moment it is chosen, and the Gemini key. */
export function ProviderStep() {
  const settingsResult = useAtomValue(aiSettingsAtom);
  const updateResult = useAtomValue(updateAiSettingsAtom);
  const update = useAtomSet(updateAiSettingsAtom);
  const settings = Option.getOrNull(AsyncResult.value(settingsResult));
  const isSaving = AsyncResult.isWaiting(updateResult);
  const loadFailure = settings === null ? AsyncResult.error(settingsResult) : Option.none();
  const saveFailure = isSaving ? Option.none() : AsyncResult.error(updateResult);

  function choose(provider: 'gemini' | 'apple') {
    if (settings === null || isSaving) return;
    update({ provider });
  }

  const provider = settings?.provider;
  const cards = [
    {
      id: 'gemini',
      name: 'Gemini',
      badge: 'Recommended',
      description: 'Fastest and most natural. Free API key from Google.',
    },
    {
      id: 'apple',
      name: 'Apple on-device',
      badge: undefined,
      description: 'Private and offline, shorter replies. No key needed.',
    },
  ] as const;

  return (
    <>
      <div className="first-run-copy">
        <h1>Who will Eva be?</h1>
        <p>Eva needs an AI model to reply. You can change this later in Settings.</p>
      </div>

      {Option.isSome(loadFailure) && (
        <p className="first-run-alert" role="alert">
          {aiSettingsErrorMessage(
            loadFailure.value,
            'Conversation AI settings could not be loaded.',
          )}
        </p>
      )}

      <div aria-label="Conversation AI" className="first-run-choices" role="radiogroup">
        {cards.map((card) => (
          // biome-ignore lint/a11y/useSemanticElements: the choice cards are whole-card buttons with a radio role, like the voice cards.
          <button
            aria-checked={provider === card.id}
            className="first-run-choice"
            data-on={provider === card.id}
            disabled={settings === null || isSaving}
            key={card.id}
            onClick={() => choose(card.id)}
            role="radio"
            type="button"
          >
            <span aria-hidden="true" className="first-run-dot" />
            <span className="first-run-choice-copy">
              <span className="first-run-choice-title">
                {card.name}
                {card.badge && <span className="first-run-badge">{card.badge}</span>}
              </span>
              <span className="first-run-choice-text">{card.description}</span>
            </span>
          </button>
        ))}
      </div>

      {Option.isSome(saveFailure) && (
        <p className="first-run-alert" role="alert">
          {aiSettingsErrorMessage(
            saveFailure.value,
            'The choice could not be saved. Please try again.',
          )}
        </p>
      )}

      {provider === 'gemini' && <GeminiKeySetup />}
      {provider === 'agy' && (
        <p className="first-run-hint">
          Antigravity is selected from an earlier setup. Choose Gemini or Apple on-device above, or
          keep it and change nothing.
        </p>
      )}
    </>
  );
}
