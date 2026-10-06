import { Button, Card } from '@heroui/react';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getAiSettings, saveAiSettings } from '@/lib/aiSettings';
import {
  type AiSettings,
  type ConversationProviderId,
  DEFAULT_AI_SETTINGS,
  isAgyModelId,
  isConversationProviderId,
  isProviderError,
} from '@/lib/types';
import { GeminiKeyField } from './GeminiKeyField';

type LoadState = { tag: 'loading' } | { tag: 'ready' } | { tag: 'error'; message: string };

type SaveState =
  | { tag: 'idle' }
  | { tag: 'saving' }
  | { tag: 'saved' }
  | { tag: 'error'; message: string };

type ConversationProviderSettingsProps = {
  defaultModel?: string;
  onSavedProviderChange?: (provider: ConversationProviderId) => void;
};

function actionableError(error: unknown, fallback: string): string {
  if (isProviderError(error)) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

export function ConversationProviderSettings({
  onSavedProviderChange,
  defaultModel,
}: ConversationProviderSettingsProps) {
  const [loadState, setLoadState] = useState<LoadState>({ tag: 'loading' });
  const [saveState, setSaveState] = useState<SaveState>({ tag: 'idle' });
  const [draftSettings, setDraftSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const requestGeneration = useRef(0);
  const saveInFlight = useRef(false);

  const loadSettings = useCallback(async () => {
    const request = ++requestGeneration.current;
    setLoadState({ tag: 'loading' });
    try {
      const loaded = await getAiSettings();
      if (request !== requestGeneration.current) return;
      setDraftSettings(loaded);
      setLoadState({ tag: 'ready' });
      onSavedProviderChange?.(loaded.provider);
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
  }, [onSavedProviderChange]);

  useEffect(() => {
    void loadSettings();
    return () => {
      requestGeneration.current += 1;
    };
  }, [loadSettings]);

  function handleProviderChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (isConversationProviderId(value)) {
      setDraftSettings((prev) => ({ ...prev, provider: value }));
      setSaveState({ tag: 'idle' });
    }
  }

  function handleModelChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (isAgyModelId(value)) {
      setDraftSettings((prev) => ({ ...prev, agy_model: value }));
      setSaveState({ tag: 'idle' });
    }
  }

  async function handleSave() {
    if (saveInFlight.current || loadState.tag !== 'ready') return;
    saveInFlight.current = true;
    setSaveState({ tag: 'saving' });
    try {
      const saved = await saveAiSettings(draftSettings);
      setDraftSettings(saved);
      setSaveState({ tag: 'saved' });
      onSavedProviderChange?.(saved.provider);
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

  return (
    <Card className="border border-white/[0.08] bg-[#161619] p-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Conversation AI</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Configure the AI provider and model used for spoken practice dialogue.
        </p>
      </div>

      {loadState.tag === 'loading' && (
        <p className="mt-4 text-sm text-zinc-400" role="status">
          Loading conversation AI settings…
        </p>
      )}

      {loadState.tag === 'error' && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-rose-300" role="alert">
            {loadState.message}
          </p>
          <div>
            <Button onPress={() => void loadSettings()} size="sm" variant="secondary">
              Retry
            </Button>
          </div>
        </div>
      )}

      {loadState.tag === 'ready' && (
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-xs font-medium text-zinc-300">
            Provider
            <select
              aria-label="Conversation AI provider"
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              disabled={saveState.tag === 'saving'}
              onChange={handleProviderChange}
              value={draftSettings.provider}
            >
              <option value="gemini">Gemini API (recommended)</option>
              <option value="apple">Apple (on-device)</option>
              <option value="agy">Antigravity CLI (legacy, slow)</option>
            </select>
          </label>

          {draftSettings.provider === 'agy' && (
            <label className="flex flex-col gap-2 text-xs font-medium text-zinc-300">
              Model
              <select
                aria-label="Antigravity CLI model"
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                disabled={saveState.tag === 'saving'}
                onChange={handleModelChange}
                value={draftSettings.agy_model}
              >
                <option value="default">Use Antigravity setting (recommended)</option>
                <option value="gemini-3.8-flash-low">Gemini 3.8 Flash Low</option>
                <option value="gemini-3.8-flash-high">Gemini 3.8 Flash High</option>
              </select>
              {draftSettings.agy_model === 'default' && (
                <span className="text-xs text-zinc-400">
                  CLI setting: {defaultModel ?? 'not specified in the local settings file'}. This
                  follows Antigravity and may change when you change its model. Use Recheck files
                  above to refresh.
                </span>
              )}
            </label>
          )}

          {draftSettings.provider === 'gemini' && <GeminiKeyField />}

          {draftSettings.provider === 'apple' && (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs leading-relaxed text-zinc-300">
              Apple requires macOS 26+, Apple Intelligence enabled, and models downloaded. Uses one
              fixed system model and starts when a practice session opens.
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs leading-relaxed text-zinc-400">
            <p>
              Detailed coaching, answer examples and memory checks still use Antigravity, which is
              slower, whichever conversation provider you choose.
            </p>
            <p className="mt-1 text-zinc-500">
              Replies use simple English and ask one short question.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              isDisabled={saveState.tag === 'saving'}
              onPress={() => void handleSave()}
              size="sm"
              variant="secondary"
            >
              {saveState.tag === 'saving' ? 'Saving…' : 'Save settings'}
            </Button>
            {saveState.tag === 'saved' && (
              <span className="text-xs font-medium text-emerald-300" role="status">
                Settings saved.
              </span>
            )}
            {saveState.tag === 'error' && (
              <span className="text-xs text-rose-300" role="alert">
                {saveState.message}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
