import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ChangeEvent, FormEvent } from 'react';
import { SettingsBlock } from '@/shared/ui/settings-block';
import { SettingsButton } from '@/shared/ui/settings-button';
import { SettingsRow } from '@/shared/ui/settings-row';
import { keyErrorMessage } from '../../helpers/key-error-message';
import { keyFieldControls } from '../../helpers/key-field-controls';
import {
  geminiKeyDraftAtom,
  geminiKeyFailureAtom,
  geminiKeyIsBusyAtom,
  geminiKeyStatusAtom,
  removeGeminiKeyAtom,
  saveGeminiKeyAtom,
} from '../../model/atoms';
import { KeyStatusLine } from '../key-status-line';
import './styles.css';

export function GeminiKeyField() {
  const statusResult = useAtomValue(geminiKeyStatusAtom);
  const [draft, setDraft] = useAtom(geminiKeyDraftAtom);
  const isBusy = useAtomValue(geminiKeyIsBusyAtom);
  const failure = useAtomValue(geminiKeyFailureAtom);
  const save = useAtomSet(saveGeminiKeyAtom);
  const remove = useAtomSet(removeGeminiKeyAtom);

  const status = Option.getOrNull(AsyncResult.value(statusResult));
  const controls = keyFieldControls({ draft, isBusy, status });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(draft);
  }

  function handleKeyInput(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDraft(value);
  }

  return (
    <>
      <SettingsRow
        description={<KeyStatusLine result={statusResult} />}
        htmlFor="gemini-key"
        onSubmit={handleSubmit}
        title="Gemini API key"
      >
        <input
          autoComplete="off"
          className="gemini-key-field__input"
          disabled={isBusy}
          id="gemini-key"
          onChange={handleKeyInput}
          placeholder={controls.placeholder}
          spellCheck={false}
          type="password"
          value={draft}
        />
        <SettingsButton disabled={!controls.canSave} type="submit">
          Save
        </SettingsButton>
        <SettingsButton
          disabled={!controls.canRemove}
          onClick={() => remove(undefined)}
          variant="ghost"
        >
          Remove
        </SettingsButton>
      </SettingsRow>
      {Option.isSome(failure) && (
        <SettingsBlock role="alert" tone="error">
          {keyErrorMessage(failure.value)}
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
