import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { FormEvent } from 'react';
import { ipcFailureMessage, type PersonalProfile } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Input } from '@/shared/ui/input';
import { Notice } from '@/shared/ui/notice';
import {
  fieldLength,
  MAX_PROFILE_FIELD_CHARS,
  PROFILE_FIELDS,
  profileSummary,
  saveProblemMessage,
} from '../../helpers/profile';
import { personalProfileAtom, profileDraftAtom, savePersonalProfileAtom } from '../../model/atoms';

const LOAD_FAILED = 'Your profile could not be loaded. Try again.';

function ProfileForm({ draft }: { draft: PersonalProfile }) {
  const setDraft = useAtomSet(profileDraftAtom);
  const save = useAtomSet(savePersonalProfileAtom);
  const saveResult = useAtomValue(savePersonalProfileAtom);
  const isSaving = AsyncResult.isWaiting(saveResult);
  const saveFailure = isSaving ? Option.none() : AsyncResult.error(saveResult);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(draft);
  }

  return (
    <form className="grid gap-x-4 gap-y-3 px-5 py-3 sm:grid-cols-2" onSubmit={submit}>
      {PROFILE_FIELDS.map(({ key, label }) => (
        <label className="grid gap-1 text-control" htmlFor={`profile-${key}`} key={key}>
          <span>{label}</span>
          <Input
            autoComplete="off"
            className="w-full"
            id={`profile-${key}`}
            onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            value={draft[key]}
          />
          <small className="text-caption text-muted">
            {fieldLength(draft[key])}/{MAX_PROFILE_FIELD_CHARS} · optional
          </small>
        </label>
      ))}
      {Option.isSome(saveFailure) && (
        <Notice className="sm:col-span-full" role="alert" tone="error">
          {saveProblemMessage(saveFailure.value)}
        </Notice>
      )}
      <div className="sm:col-span-full">
        <Button disabled={isSaving} tone="primary" type="submit">
          {isSaving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}

export function AboutYou() {
  const profileResult = useAtomValue(personalProfileAtom);
  const reload = useAtomRefresh(personalProfileAtom);
  const [draft, setDraft] = useAtom(profileDraftAtom);
  const profile = Option.getOrNull(AsyncResult.value(profileResult));

  if (profile === null) {
    return Option.match(AsyncResult.error(profileResult), {
      onNone: () => (
        <Notice role="status" tone="quiet">
          Loading…
        </Notice>
      ),
      onSome: (failure) => (
        <FormRow description={ipcFailureMessage(failure, LOAD_FAILED)} title="About you">
          <Button onClick={reload}>Retry</Button>
        </FormRow>
      ),
    });
  }

  const isEditing = draft !== null;
  return (
    <>
      <FormRow description={profileSummary(profile)} title="About you">
        <Button aria-expanded={isEditing} onClick={() => setDraft(isEditing ? null : profile)}>
          {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </FormRow>
      {draft !== null && <ProfileForm draft={draft} />}
    </>
  );
}
