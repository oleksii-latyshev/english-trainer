import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ipcFailureMessage } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { FormRow } from '@/shared/ui/form-row';
import { Input } from '@/shared/ui/input';
import { Notice } from '@/shared/ui/notice';
import { canAddTerm, hiddenTermCount, visibleTerms } from '../../helpers/glossary';
import {
  addGlossaryTermAtom,
  glossaryAtom,
  glossaryDraftAtom,
  removeGlossaryTermAtom,
} from '../../model/atoms';

const LOAD_FAILED = 'The glossary could not be read.';
const SAVE_FAILED = 'The glossary could not be saved. Try again.';

function AddTermForm() {
  const [draft, setDraft] = useAtom(glossaryDraftAtom);
  const add = useAtomSet(addGlossaryTermAtom);
  const isAdding = AsyncResult.isWaiting(useAtomValue(addGlossaryTermAtom));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canAddTerm(draft)) add(draft);
  }

  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <Input
        aria-label="Add a word or name"
        autoComplete="off"
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        placeholder="A word, name or term"
        value={draft}
      />
      <Button disabled={!canAddTerm(draft) || isAdding} type="submit">
        Add
      </Button>
    </form>
  );
}

function Terms({ terms }: { terms: readonly string[] }) {
  const remove = useAtomSet(removeGlossaryTermAtom);
  const [showAll, setShowAll] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const hidden = hiddenTermCount(terms, showAll);
  return (
    <div className="grid gap-2.5 px-5 pb-3">
      <ul aria-label="Glossary words" className="flex flex-wrap gap-1.5">
        {visibleTerms(terms, showAll).map((term) => (
          <li key={term}>
            <Chip>
              {term}
              <button
                aria-label={`Remove ${term}`}
                className="text-muted hover:text-foreground inline-flex size-4 items-center justify-center rounded-full"
                onClick={() => remove(term)}
                type="button"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </Chip>
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <Button onClick={() => setShowAll(true)} size="sm" tone="ghost">
              +{hidden} more
            </Button>
          </li>
        )}
        <li>
          <Button
            aria-expanded={isAdding}
            onClick={() => setIsAdding(!isAdding)}
            size="sm"
            tone="ghost"
          >
            + Add a word or name
          </Button>
        </li>
      </ul>
      {isAdding && <AddTermForm />}
    </div>
  );
}

export function Glossary() {
  const glossary = useAtomValue(glossaryAtom);
  const reload = useAtomRefresh(glossaryAtom);
  const removeResult = useAtomValue(removeGlossaryTermAtom);
  const addResult = useAtomValue(addGlossaryTermAtom);
  const terms = Option.getOrNull(AsyncResult.value(glossary));
  const lastFailure = [addResult, removeResult]
    .filter((result) => !AsyncResult.isWaiting(result))
    .map((result) => AsyncResult.error(result))
    .find(Option.isSome);

  if (terms === null) {
    return Option.match(AsyncResult.error(glossary), {
      onNone: () => (
        <Notice role="status" tone="quiet">
          Loading…
        </Notice>
      ),
      onSome: (failure) => (
        <FormRow description={ipcFailureMessage(failure, LOAD_FAILED)} title="Personal glossary">
          <Button onClick={reload}>Retry</Button>
        </FormRow>
      ),
    });
  }

  return (
    <>
      <FormRow description="Words speech recognition should know." title="Personal glossary" />
      <Terms terms={terms} />
      {lastFailure && Option.isSome(lastFailure) && (
        <Notice role="alert" tone="error">
          {ipcFailureMessage(lastFailure.value, SAVE_FAILED)}
        </Notice>
      )}
    </>
  );
}
