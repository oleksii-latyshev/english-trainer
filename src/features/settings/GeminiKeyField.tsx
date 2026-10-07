import { Check } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { SettingsButton } from './SettingsControls';
import { SettingsBlock, SettingsRow } from './SettingsGroup';
import { type KeyState, useGeminiKey } from './useGeminiKey';

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

export function GeminiKeyField() {
  const { state, status, isWorking, draftKey, setDraftKey, save, remove } = useGeminiKey();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  function handleKeyInput(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDraftKey(value);
  }

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
          onClick={remove}
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
