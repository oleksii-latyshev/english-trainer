import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  getTranslationSettings,
  getTranslationStatus,
  prepareTranslationLanguages,
  saveTranslationSettings,
} from '@/lib/translationApi';
import {
  isTranslationError,
  isTranslationLanguage,
  TRANSLATION_LANGUAGES,
  type TranslationError,
  type TranslationLanguage,
  type TranslationSettings as TranslationSettingsData,
  type TranslationStatus,
} from '@/lib/translationTypes';
import { SettingsButton } from './SettingsControls';
import { SettingsBlock, SettingsGroup, SettingsRow } from './SettingsGroup';

type LoadState = { tag: 'loading' } | { tag: 'ready' } | { tag: 'error'; error: TranslationError };
type StatusState =
  | { tag: 'loading' }
  | { tag: 'ready'; status: TranslationStatus }
  | { tag: 'error'; error: TranslationError };

function readableError(value: unknown): TranslationError {
  return isTranslationError(value)
    ? value
    : { code: 'unavailable', message: 'Translation settings could not be read. Try again.' };
}

function statusError(message: string): TranslationError {
  return { code: 'invalid_output', message };
}

export function TranslationSettings() {
  const [settings, setSettings] = useState<TranslationSettingsData>();
  const [load, setLoad] = useState<LoadState>({ tag: 'loading' });
  const [status, setStatus] = useState<StatusState>({ tag: 'loading' });
  const [problem, setProblem] = useState<TranslationError>();
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const settingsGeneration = useRef(0);
  const statusGeneration = useRef(0);
  const prepareGeneration = useRef(0);
  const prepareInFlight = useRef(false);

  const refreshStatus = useCallback(async (language: TranslationLanguage) => {
    const request = ++statusGeneration.current;
    setStatus({ tag: 'loading' });
    try {
      const loaded = await getTranslationStatus();
      if (request !== statusGeneration.current) return;
      if (loaded.native_language !== language) {
        setStatus({
          tag: 'error',
          error: statusError('Availability was reported for a different language. Retry.'),
        });
        return;
      }
      setStatus({ tag: 'ready', status: loaded });
    } catch (cause) {
      if (request === statusGeneration.current)
        setStatus({ tag: 'error', error: readableError(cause) });
    }
  }, []);

  const reload = useCallback(async () => {
    const request = ++settingsGeneration.current;
    setLoad({ tag: 'loading' });
    setProblem(undefined);
    try {
      const loaded = await getTranslationSettings();
      if (request !== settingsGeneration.current) return;
      setSettings(loaded);
      setLoad({ tag: 'ready' });
      void refreshStatus(loaded.native_language);
    } catch (cause) {
      if (request === settingsGeneration.current)
        setLoad({ tag: 'error', error: readableError(cause) });
    }
  }, [refreshStatus]);

  useEffect(() => {
    void reload();
    return () => {
      settingsGeneration.current += 1;
      statusGeneration.current += 1;
      prepareGeneration.current += 1;
    };
  }, [reload]);

  async function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (!isTranslationLanguage(value) || !settings || isSaving || isPreparing) return;
    const request = ++settingsGeneration.current;
    setIsSaving(true);
    setProblem(undefined);
    try {
      const saved = await saveTranslationSettings({ native_language: value });
      if (request !== settingsGeneration.current) return;
      setSettings(saved);
      void refreshStatus(saved.native_language);
    } catch (cause) {
      if (request === settingsGeneration.current) setProblem(readableError(cause));
    } finally {
      if (request === settingsGeneration.current) setIsSaving(false);
    }
  }

  async function prepareLanguages(language: TranslationLanguage) {
    if (prepareInFlight.current) return;
    prepareInFlight.current = true;
    const request = ++prepareGeneration.current;
    setIsPreparing(true);
    setProblem(undefined);
    try {
      const prepared = await prepareTranslationLanguages();
      if (request !== prepareGeneration.current) return;
      if (prepared.native_language !== language) {
        setProblem(statusError('Availability was reported for a different language. Retry.'));
      } else {
        setStatus({ tag: 'ready', status: prepared });
      }
    } catch (cause) {
      if (request === prepareGeneration.current) setProblem(readableError(cause));
    } finally {
      if (request === prepareGeneration.current) {
        prepareInFlight.current = false;
        setIsPreparing(false);
      }
    }
  }

  const selectedLanguage = settings?.native_language;
  const currentStatus = status.tag === 'ready' ? status.status : undefined;

  return (
    <SettingsGroup id="translation" title="Translation">
      {load.tag === 'loading' && (
        <SettingsBlock role="status" tone="quiet">
          Loading translation settings…
        </SettingsBlock>
      )}
      {load.tag === 'error' && (
        <SettingsRow
          description={load.error.message}
          title="Translation settings could not be loaded"
        >
          <SettingsButton onClick={() => void reload()}>Retry</SettingsButton>
        </SettingsRow>
      )}
      {load.tag === 'ready' && settings && (
        <>
          <SettingsRow
            description="Selected English words are translated into this language on demand."
            htmlFor="translation-language"
            title="Native language"
          >
            <select
              className="settings-select"
              disabled={isSaving || isPreparing}
              id="translation-language"
              onChange={(event) => void handleLanguageChange(event)}
              value={settings.native_language}
            >
              {TRANSLATION_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </SettingsRow>
          <SettingsRow
            description={
              status.tag === 'ready'
                ? status.status.message
                : status.tag === 'error'
                  ? status.error.message
                  : 'Checking language availability…'
            }
            title="Language availability"
          >
            {currentStatus?.status === 'download_required' && selectedLanguage && (
              <SettingsButton
                disabled={isPreparing}
                onClick={() => void prepareLanguages(selectedLanguage)}
              >
                {isPreparing ? 'Preparing…' : 'Prepare languages'}
              </SettingsButton>
            )}
            {status.tag === 'error' && selectedLanguage && (
              <SettingsButton onClick={() => void refreshStatus(selectedLanguage)}>
                Retry
              </SettingsButton>
            )}
          </SettingsRow>
          <SettingsBlock>
            Translation stays on this Mac. English explanations use Apple Intelligence and may be
            unavailable independently.
          </SettingsBlock>
          {problem && (
            <SettingsBlock role="alert" tone="error">
              {problem.message}
            </SettingsBlock>
          )}
        </>
      )}
    </SettingsGroup>
  );
}
