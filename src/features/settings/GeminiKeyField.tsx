import { Button } from '@heroui/react';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import {
  deleteGeminiApiKey,
  type GeminiKeyStatus,
  getGeminiKeyStatus,
  saveGeminiApiKey,
} from '@/lib/geminiKey';
import { isProviderError } from '@/lib/types';

type KeyState =
  | { tag: 'loading' }
  | { tag: 'ready'; status: GeminiKeyStatus }
  | { tag: 'working'; status: GeminiKeyStatus | null }
  | { tag: 'error'; message: string; status: GeminiKeyStatus | null };

function keyErrorMessage(error: unknown): string {
  if (isProviderError(error)) return error.message;
  return 'Could not update the Gemini API key. Please try again.';
}

function statusLabel(status: GeminiKeyStatus): string {
  if (!status.configured) return 'No API key saved.';
  return status.source === 'environment'
    ? 'Using the ENG_TRAINER_GEMINI_API_KEY environment variable.'
    : 'Gemini API key saved — encrypted on this Mac.';
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
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="text-xs text-zinc-300" role="status">
        {state.tag === 'loading' && 'Checking for a saved API key…'}
        {status && statusLabel(status)}
      </p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={handleSubmit}>
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs font-medium text-zinc-300">
          Gemini API key
          <input
            autoComplete="off"
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            disabled={isWorking}
            onChange={handleKeyInput}
            spellCheck={false}
            type="password"
            value={draftKey}
          />
        </label>
        <Button
          isDisabled={isWorking || draftKey.trim().length === 0}
          size="sm"
          type="submit"
          variant="secondary"
        >
          Save key
        </Button>
        <Button
          isDisabled={isWorking || status?.source !== 'settings'}
          onPress={() => void change(deleteGeminiApiKey)}
          size="sm"
          variant="secondary"
        >
          Remove key
        </Button>
      </form>
      {state.tag === 'error' && (
        <p className="text-xs text-rose-300" role="alert">
          {state.message}
        </p>
      )}
      <p className="text-xs leading-relaxed text-zinc-400">
        On the free tier, requests cost nothing and are not billed unless billing is enabled for the
        key&apos;s Google Cloud project in Google AI Studio. When a free daily or per-minute limit
        is reached, Gemini refuses requests (rate limited) and the app answers with Apple on-device
        instead. Limits and usage are shown in Google AI Studio.
      </p>
      <p className="text-xs leading-relaxed text-zinc-400">
        Free-tier prompts may be used by Google to improve its products and may be read by human
        reviewers. Only your practice transcripts are sent. Get a key in Google AI Studio.
      </p>
    </div>
  );
}
