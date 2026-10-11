import { useEffect, useState } from 'react';
import { getGlossary, saveGlossary, speechErrorMessage } from '@/lib/speechTypes';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { glossarySummary } from './lib/speechCheck';

type LoadState =
  | { tag: 'loading' }
  | { tag: 'ready'; terms: string[] }
  | { tag: 'error'; message: string };

/** The editable glossary stays separate from the terms derived from the profile. */
export function GlossarySettings() {
  const [state, setState] = useState<LoadState>({ tag: 'loading' });
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    getGlossary().then(
      (terms) => {
        if (isCurrent) setState({ tag: 'ready', terms });
      },
      (cause) => {
        if (isCurrent) {
          setState({
            tag: 'error',
            message: speechErrorMessage(cause, 'The glossary could not be read.'),
          });
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  async function change(terms: string[]) {
    setProblem(undefined);
    try {
      setState({ tag: 'ready', terms: await saveGlossary(terms) });
      return true;
    } catch (cause) {
      setProblem(speechErrorMessage(cause, 'The glossary could not be saved. Try again.'));
      return false;
    }
  }

  async function handleAdd() {
    if (state.tag !== 'ready' || draft.trim() === '') return;
    if (await change([...state.terms, draft])) setDraft('');
  }

  const terms = state.tag === 'ready' ? state.terms : [];
  return (
    <>
      {state.tag === 'error' ? (
        <Notice role="alert" tone="error">
          {state.message}
        </Notice>
      ) : (
        <FormRow
          description={
            state.tag === 'loading'
              ? 'Loading…'
              : `Words speech recognition should know: ${glossarySummary(terms)}`
          }
          title="Personal glossary"
        >
          <Button
            aria-expanded={isEditing}
            disabled={state.tag !== 'ready'}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Done' : `Edit · ${terms.length}`}
          </Button>
        </FormRow>
      )}
      {isEditing && state.tag === 'ready' && (
        <Notice>
          <ul aria-label="Glossary words" className="glossary-terms">
            {terms.map((term) => (
              <li key={term}>
                <span>{term}</span>
                <button
                  aria-label={`Remove ${term}`}
                  onClick={() => void change(terms.filter((other) => other !== term))}
                  type="button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form
            className="glossary-add"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAdd();
            }}
          >
            <input
              aria-label="Add a word or name"
              className="settings-field glossary-input"
              onChange={(event) => {
                const value = event.target.value;
                setDraft(value);
              }}
              placeholder="A word, name or term"
              value={draft}
            />
            <Button disabled={draft.trim() === ''} type="submit">
              Add
            </Button>
          </form>
          {problem && <p role="alert">{problem}</p>}
        </Notice>
      )}
    </>
  );
}
