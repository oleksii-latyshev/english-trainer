import { Check } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import {
  deleteGeminiApiKey,
  type GeminiKeyStatus,
  getGeminiKeyStatus,
  saveGeminiApiKey,
} from '@/lib/geminiKey';
import { isProviderError } from '@/lib/types';
import { SettingsButton } from './SettingsControls';
import { SettingsBlock, SettingsRow } from './SettingsGroup';

type KeyState =
  | { tag: 'loading' }
  | { tag: 'ready'; status: GeminiKeyStatus }
  | { tag: 'working'; status: GeminiKeyStatus | null }
  | { tag: 'error'; message: string; status: GeminiKeyStatus | null };

function keyErrorMessage(error: unknown): string {
  if (isProviderError(error)) return error.message;
  return 'Could not update the Gemini API key. Please try again.';
}

function StatusLine({ state }: { state: KeyState }) {
  if (state.tag === 'loading') return <>Checking for a saved API key…</>;
  const { status } = state;
  if (!status?.configured) return <>No API key saved.</>;
  return (
    <span className="settings-status">
      <Check aria-hidden="true" size={12} strokeWidth={2.4} />
      {status.source === 'environment'
        ? 'Using the ENG_TRAINER_GEMINI_API_KEY environment variable'
        : 'Saved, encrypted on this Mac'}
    </span>
  );
}

function currentStatus(state: KeyState): GeminiKeyStatus | null {
  return state.tag === 'loading' ? null : state.status;
}

export function GeminiKeyField() {
  const [state, setState] = useState<KeyState>({ tag: 'loading' });
  const [draftKey, setDraftKey] = useState('');

  useEffect(() => {
    let isCurrent = true;
    getGeminiKeyStatus()
      .then((status) => {
        if (isCurrent) setState({ tag: 'ready', status });
      })
      .catch((error: unknown) => {
        if (isCurrent) setState({ tag: 'error', message: keyErrorMessage(error), status: null });
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  async function change(action: () => Promise<void>) {
    const previous = currentStatus(state);
    setState({ tag: 'working', status: previous });
    try {
      await action();
      setState({ tag: 'ready', status: await getGeminiKeyStatus() });
      setDraftKey('');
    } catch (error) {
      setState({ tag: 'error', message: keyErrorMessage(error), status: previous });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change(() => saveGeminiApiKey(draftKey));
  }

  function handleKeyInput(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDraftKey(value);
  }

  const status = currentStatus(state);
  const isWorking = state.tag === 'working';

  return (
    <>
      <SettingsRow
        description={<StatusLine state={state} />}
        htmlFor="gemini-key"
        onSubmit={handleSubmit}
        title="Gemini API key"
      >
        <input
          autoComplete="off"
          className="settings-field"
          disabled={isWorking}
          id="gemini-key"
          onChange={handleKeyInput}
          placeholder={status?.configured ? '••••••••••••••••' : 'Paste your key'}
          spellCheck={false}
          type="password"
          value={draftKey}
        />
        <SettingsButton disabled={isWorking || draftKey.trim().length === 0} type="submit">
          Save
        </SettingsButton>
        <SettingsButton
          disabled={isWorking || status?.source !== 'settings'}
          onClick={() => void change(deleteGeminiApiKey)}
          variant="ghost"
        >
          Remove
        </SettingsButton>
      </SettingsRow>
      {state.tag === 'error' && (
        <SettingsBlock role="alert" tone="error">
          {state.message}
        </SettingsBlock>
      )}
      <SettingsBlock tone="quiet">
        <p>
          On the free tier, Google may use what you send to improve its models. Don't share anything
          private in practice sessions.
        </p>
        <p>
          When a free limit is reached, replies come from Apple on-device instead. Limits and usage
          are in Google AI Studio.
        </p>
      </SettingsBlock>
    </>
  );
}
