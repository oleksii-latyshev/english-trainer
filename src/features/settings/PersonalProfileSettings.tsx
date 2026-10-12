import { type FormEvent, useEffect, useState } from 'react';
import {
  EMPTY_PERSONAL_PROFILE,
  getPersonalProfile,
  savePersonalProfile,
} from '@/lib/personalProfile';
import {
  isPersonalProfile,
  type PersonalProfile,
  personalProfileSummary,
} from '@/lib/personalProfileTypes';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { GlossarySettings } from './GlossarySettings';

type LoadState = { tag: 'loading' } | { tag: 'ready'; profile: PersonalProfile } | { tag: 'error' };

const PROFILE_FIELDS: { key: keyof PersonalProfile; label: string }[] = [
  { key: 'role', label: 'Role' },
  { key: 'stack', label: 'Stack' },
  { key: 'interests', label: 'Interests' },
  { key: 'goals', label: 'Goals' },
];

export function PersonalProfileSettings() {
  const [state, setState] = useState<LoadState>({ tag: 'loading' });
  const [draft, setDraft] = useState<PersonalProfile>(EMPTY_PERSONAL_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let isCurrent = true;
    getPersonalProfile().then(
      (profile) => {
        if (isCurrent) setState({ tag: 'ready', profile });
      },
      () => {
        if (isCurrent) setState({ tag: 'error' });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  function beginEdit() {
    if (state.tag !== 'ready') return;
    setDraft(state.profile);
    setProblem('');
    setIsEditing(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPersonalProfile(draft)) {
      setProblem('Each field must be 150 characters or fewer.');
      return;
    }
    setIsSaving(true);
    setProblem('');
    try {
      const profile = await savePersonalProfile(draft);
      setState({ tag: 'ready', profile });
      setIsEditing(false);
    } catch {
      setProblem('Your profile could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <GroupCard id="personalisation" title="Personalisation">
      {state.tag === 'error' ? (
        <Notice role="alert" tone="error">
          Your profile could not be loaded. Reopen Settings to try again.
        </Notice>
      ) : (
        <FormRow
          description={state.tag === 'loading' ? 'Loading…' : personalProfileSummary(state.profile)}
          title="About you"
        >
          <Button
            aria-expanded={isEditing}
            disabled={state.tag !== 'ready' || isSaving}
            onClick={isEditing ? () => setIsEditing(false) : beginEdit}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
        </FormRow>
      )}
      {isEditing && (
        <form className="personal-profile-form" onSubmit={(event) => void handleSave(event)}>
          {PROFILE_FIELDS.map((field) => (
            <label
              className="personal-profile-field"
              htmlFor={`profile-${field.key}`}
              key={field.key}
            >
              <span>{field.label}</span>
              <input
                autoComplete="off"
                id={`profile-${field.key}`}
                maxLength={150}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft((current) => ({ ...current, [field.key]: value }));
                }}
                value={draft[field.key]}
              />
              <small>{Array.from(draft[field.key]).length}/150 · optional</small>
            </label>
          ))}
          {problem && (
            <p className="personal-profile-error" role="alert">
              {problem}
            </p>
          )}
          <div className="personal-profile-actions">
            <Button disabled={isSaving} type="submit">
              {isSaving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      )}
      <GlossarySettings />
    </GroupCard>
  );
}
