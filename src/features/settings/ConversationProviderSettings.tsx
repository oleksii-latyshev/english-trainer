import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { GeminiKeyField } from '@/features/gemini-key';
import { getAiSettings, isEvaStyleId, saveAiSettings } from '@/lib/aiSettings';
import {
  type AiSettings,
  type ConversationProviderId,
  DEFAULT_AI_SETTINGS,
  isAgyModelId,
  isProviderError,
} from '@/lib/types';
import { Button } from '@/shared/ui/button';
import { FormRow, FormRowDescription, FormRowTitle } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { ProviderResponseTest } from './ProviderResponseTest';

type LoadState = { tag: 'loading' } | { tag: 'ready' } | { tag: 'error'; message: string };

type SaveState = { tag: 'idle' } | { tag: 'saving' } | { tag: 'error'; message: string };

const PROVIDER_CARDS = [
  {
    id: 'gemini',
    name: 'Gemini',
    badge: 'Recommended',
    description: 'Fastest, most natural replies. Needs an API key.',
  },
  {
    id: 'apple',
    name: 'Apple on-device',
    description: 'Private and offline, shorter replies. Used as the backup.',
  },
  {
    id: 'agy',
    name: 'Antigravity',
    legacy: true,
    description: 'Slower. Kept for compatibility.',
  },
] as const satisfies readonly {
  id: ConversationProviderId;
  name: string;
  badge?: string;
  legacy?: boolean;
  description: string;
}[];

function actionableError(error: unknown, fallback: string): string {
  if (isProviderError(error)) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

export function ConversationProviderSettings() {
  const [loadState, setLoadState] = useState<LoadState>({ tag: 'loading' });
  const [saveState, setSaveState] = useState<SaveState>({ tag: 'idle' });
  // What is saved; the test and the radio cards both follow it.
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const requestGeneration = useRef(0);
  const saveInFlight = useRef(false);

  const loadSettings = useCallback(async () => {
    const request = ++requestGeneration.current;
    setLoadState({ tag: 'loading' });
    try {
      const loaded = await getAiSettings();
      if (request !== requestGeneration.current) return;
      setSettings(loaded);
      setLoadState({ tag: 'ready' });
    } catch (error) {
      if (request !== requestGeneration.current) return;
      setLoadState({
        tag: 'error',
        message: actionableError(
          error,
          'Failed to load conversation AI settings. Please check your setup and try again.',
        ),
      });
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    return () => {
      requestGeneration.current += 1;
    };
  }, [loadSettings]);

  // A choice is saved the moment it is made; the card only changes once the backend confirms it.
  async function save(next: AiSettings) {
    if (saveInFlight.current || loadState.tag !== 'ready') return;
    saveInFlight.current = true;
    setSaveState({ tag: 'saving' });
    try {
      setSettings(await saveAiSettings(next));
      setSaveState({ tag: 'idle' });
    } catch (error) {
      setSaveState({
        tag: 'error',
        message: actionableError(
          error,
          'Failed to save conversation AI settings. Please try again.',
        ),
      });
    } finally {
      saveInFlight.current = false;
    }
  }

  function handleModelChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (isAgyModelId(value)) void save({ ...settings, agy_model: value });
  }

  function handleStyleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (isEvaStyleId(value)) void save({ ...settings, eva_style: value });
  }

  const isSaving = saveState.tag === 'saving';

  return (
    <GroupCard id="ai" title="Conversation AI">
      {loadState.tag === 'loading' && (
        <Notice role="status" tone="quiet">
          Loading conversation AI settings…
        </Notice>
      )}

      {loadState.tag === 'error' && (
        <FormRow description={loadState.message} title="Settings could not be loaded">
          <Button onClick={() => void loadSettings()}>Retry</Button>
        </FormRow>
      )}

      {loadState.tag === 'ready' && (
        <>
          <div aria-label="Conversation AI provider" className="settings-radios" role="radiogroup">
            {PROVIDER_CARDS.map((card) => (
              <label className="settings-radio" key={card.id}>
                <input
                  checked={settings.provider === card.id}
                  disabled={isSaving}
                  name="conversation-provider"
                  onChange={() => void save({ ...settings, provider: card.id })}
                  type="radio"
                  value={card.id}
                />
                <span aria-hidden="true" className="settings-radio-dot" />
                <span>
                  <FormRowTitle>
                    {card.name}
                    {'badge' in card && <span className="settings-badge">{card.badge}</span>}
                    {'legacy' in card && <span className="settings-legacy"> · legacy</span>}
                  </FormRowTitle>
                  <FormRowDescription>{card.description}</FormRowDescription>
                </span>
              </label>
            ))}
          </div>

          {saveState.tag === 'error' && (
            <Notice role="alert" tone="error">
              {saveState.message}
            </Notice>
          )}

          {settings.provider === 'agy' && (
            <FormRow
              description="Every Antigravity request names a Gemini model, so Antigravity's own default is never used."
              htmlFor="agy-model"
              title="Antigravity model"
            >
              <select
                className="settings-select"
                disabled={isSaving}
                id="agy-model"
                onChange={handleModelChange}
                value={settings.agy_model}
              >
                <option value="default">Gemini 3.8 Flash Medium (recommended)</option>
                <option value="gemini-3.8-flash-low">Gemini 3.8 Flash Low</option>
                <option value="gemini-3.8-flash-high">Gemini 3.8 Flash High</option>
              </select>
            </FormRow>
          )}

          {settings.provider === 'gemini' && <GeminiKeyField />}

          <FormRow
            description="Natural: two to four sentences with her own reactions. Short and simple: one or two plain sentences. Eva always ends with one question."
            htmlFor="eva-style"
            title="Eva's style"
          >
            <select
              className="settings-select"
              disabled={isSaving}
              id="eva-style"
              onChange={handleStyleChange}
              value={settings.eva_style}
            >
              <option value="natural">Natural</option>
              <option value="short_and_simple">Short and simple</option>
            </select>
          </FormRow>

          <ProviderResponseTest provider={settings.provider} />

          <Notice tone="quiet">
            <p>
              Coaching under your answers runs in the background through Antigravity with Gemini 3.8
              Flash, whichever conversation provider you choose, so it never slows Eva down. Answer
              examples and memory checks use Antigravity too.
            </p>
          </Notice>
        </>
      )}
    </GroupCard>
  );
}
