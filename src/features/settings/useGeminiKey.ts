import { useEffect, useState } from 'react';
import {
  deleteGeminiApiKey,
  type GeminiKeyStatus,
  getGeminiKeyStatus,
  saveGeminiApiKey,
} from '@/lib/geminiKey';
import { isProviderError } from '@/lib/types';

export type KeyState =
  | { tag: 'loading' }
  | { tag: 'ready'; status: GeminiKeyStatus }
  | { tag: 'working'; status: GeminiKeyStatus | null }
  | { tag: 'error'; message: string; status: GeminiKeyStatus | null };

function keyErrorMessage(error: unknown): string {
  if (isProviderError(error)) return error.message;
  return 'Could not update the Gemini API key. Please try again.';
}

function currentStatus(state: KeyState): GeminiKeyStatus | null {
  return state.tag === 'loading' ? null : state.status;
}

/** The saved-key state and the save/remove actions, shared by Settings and first run. */
export function useGeminiKey(onSaved?: () => void) {
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

  async function change(action: () => Promise<void>): Promise<boolean> {
    const previous = currentStatus(state);
    setState({ tag: 'working', status: previous });
    try {
      await action();
      setState({ tag: 'ready', status: await getGeminiKeyStatus() });
      setDraftKey('');
      return true;
    } catch (error) {
      setState({ tag: 'error', message: keyErrorMessage(error), status: previous });
      return false;
    }
  }

  async function save() {
    if (await change(() => saveGeminiApiKey(draftKey))) onSaved?.();
  }

  return {
    state,
    status: currentStatus(state),
    isWorking: state.tag === 'working',
    draftKey,
    setDraftKey,
    save,
    remove: () => void change(deleteGeminiApiKey),
  };
}
