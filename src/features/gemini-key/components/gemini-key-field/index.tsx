import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Input } from '@/shared/ui/input';
import { Notice } from '@/shared/ui/notice';
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
      <FormRow
        description={<KeyStatusLine result={statusResult} />}
        htmlFor="gemini-key"
        onSubmit={handleSubmit}
        title="Gemini API key"
      >
        <Input
          autoComplete="off"
          disabled={isBusy}
          id="gemini-key"
          onChange={handleKeyInput}
          placeholder={controls.placeholder}
          spellCheck={false}
          type="password"
          value={draft}
        />
        <Button disabled={!controls.canSave} type="submit">
          Save
        </Button>
        <Button disabled={!controls.canRemove} onClick={() => remove(undefined)} tone="ghost">
          Remove
        </Button>
      </FormRow>
      {Option.isSome(failure) && (
        <Notice role="alert" tone="error">
          {keyErrorMessage(failure.value)}
        </Notice>
      )}
      <Notice tone="quiet">
        <p>
          On the free tier, Google may use what you send to improve its models. Don't share anything
          private in practice sessions.
        </p>
        <p className="mt-1.5">
          When a free limit is reached, replies come from Apple on-device instead. Limits and usage
          are in Google AI Studio.
        </p>
      </Notice>
    </>
  );
}
