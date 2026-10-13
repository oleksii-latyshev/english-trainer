import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Check } from 'lucide-react';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';
import { openExternalLinkAtom } from '@/core/external-link';
import { Input } from '@/shared/ui/input';
import { ListActionRow, ListFootnote, ListGroup, ListRow } from '@/shared/ui/list-group';
import { Notice } from '@/shared/ui/notice';
import { keyErrorMessage } from '../../helpers/key-error-message';
import { keyFieldControls } from '../../helpers/key-field-controls';
import {
  geminiKeyDraftAtom,
  geminiKeyFailureAtom,
  geminiKeyIsBusyAtom,
  geminiKeyStatusAtom,
  saveGeminiKeyAtom,
} from '../../model/atoms';

const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey';

export function GeminiKeyList() {
  const statusResult = useAtomValue(geminiKeyStatusAtom);
  const [draft, setDraft] = useAtom(geminiKeyDraftAtom);
  const isBusy = useAtomValue(geminiKeyIsBusyAtom);
  const failure = useAtomValue(geminiKeyFailureAtom);
  const save = useAtomSet(saveGeminiKeyAtom);
  const openLink = useAtomSet(openExternalLinkAtom);

  const status = Option.getOrNull(AsyncResult.value(statusResult));
  const controls = keyFieldControls({ draft, isBusy, status });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controls.canSave) save(draft);
  }

  function handleKeyInput(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDraft(value);
  }

  function handleLink(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    openLink(GEMINI_KEY_URL);
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit}>
        <ListGroup>
          <ListRow
            title={<label htmlFor="gemini-key-list">API key</label>}
            trailing={
              <>
                <Input
                  appearance="plain"
                  autoComplete="off"
                  disabled={isBusy}
                  id="gemini-key-list"
                  onChange={handleKeyInput}
                  placeholder={controls.placeholder}
                  spellCheck={false}
                  type="password"
                  value={draft}
                />
                {status?.configured === true && (
                  <span className="flex items-center gap-1 text-caption text-ok-text" role="status">
                    <Check aria-hidden="true" size={13} strokeWidth={2.4} />
                    Saved
                  </span>
                )}
              </>
            }
          />
          <ListActionRow disabled={!controls.canSave} type="submit">
            {status?.configured === true ? 'Replace key' : 'Paste and save key'}
          </ListActionRow>
        </ListGroup>
      </form>
      {Option.isSome(failure) && (
        <Notice role="alert" tone="error">
          {keyErrorMessage(failure.value)}
        </Notice>
      )}
      <ListFootnote>
        <a
          className="text-link hover:text-link-hover"
          href={GEMINI_KEY_URL}
          onClick={handleLink}
          rel="noreferrer"
          target="_blank"
        >
          Get a free key
        </a>{' '}
        · Stored encrypted on this Mac. On the free tier, Google may use what you send to improve
        its models — practice text only, never audio.
      </ListFootnote>
    </div>
  );
}
