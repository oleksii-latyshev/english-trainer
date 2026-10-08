import { useEffect, useState } from 'react';
import {
  deleteKeptRecordings,
  getKeptRecordings,
  getSpeechSettings,
  type KeptRecordings,
  saveKeepRawAudio,
  speechErrorMessage,
} from '@/lib/speechTypes';
import { formatSize } from './lib/speechCheck';
import { SettingsButton, Switch } from './SettingsControls';
import { SettingsBlock, SettingsGroup, SettingsRow } from './SettingsGroup';

type RetentionState =
  | { tag: 'loading' }
  | { tag: 'ready'; keepsAudio: boolean; kept: KeptRecordings }
  | { tag: 'error'; message: string };

function keptText(kept: KeptRecordings): string {
  if (kept.count === 0) return 'No recordings are kept.';
  const noun = kept.count === 1 ? 'recording' : 'recordings';
  return `${kept.count} ${noun} kept, ${formatSize(kept.size_bytes)}, in the recordings folder of the app data.`;
}

export function PrivacySettings() {
  const [state, setState] = useState<RetentionState>({ tag: 'loading' });
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getSpeechSettings(), getKeptRecordings()]).then(
      ([settings, kept]) => {
        if (isCurrent) setState({ tag: 'ready', keepsAudio: settings.keep_raw_audio, kept });
      },
      (cause) => {
        if (isCurrent) {
          setState({
            tag: 'error',
            message: speechErrorMessage(cause, 'The audio setting could not be read.'),
          });
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleToggle(keepsAudio: boolean) {
    setProblem(undefined);
    try {
      const settings = await saveKeepRawAudio(keepsAudio);
      setState((current) =>
        current.tag === 'ready' ? { ...current, keepsAudio: settings.keep_raw_audio } : current,
      );
    } catch (cause) {
      setProblem(speechErrorMessage(cause, 'The setting could not be saved. Try again.'));
    }
  }

  async function handleDelete() {
    setProblem(undefined);
    try {
      const kept = await deleteKeptRecordings();
      setState((current) => (current.tag === 'ready' ? { ...current, kept } : current));
    } catch (cause) {
      setProblem(speechErrorMessage(cause, 'The recordings could not be deleted. Try again.'));
    }
  }

  return (
    <SettingsGroup id="privacy" title="Privacy">
      <SettingsRow
        description="Speech recognition, your history, Memory, session numbers."
        title="Stays on this Mac"
      />
      <SettingsRow
        description="The text of your answers and Eva's recent replies — never audio."
        title="Sent to the AI"
      />
      {state.tag === 'ready' && (
        <>
          <SettingsRow
            description={
              state.keepsAudio
                ? 'On: each answer is kept on this Mac as a recording, after transcription, until you delete it. Nothing is uploaded.'
                : 'Off: audio is deleted right after transcription.'
            }
            title="Keep raw audio"
          >
            <Switch
              checked={state.keepsAudio}
              label="Keep raw audio"
              onChange={(next) => void handleToggle(next)}
            />
          </SettingsRow>
          <SettingsRow description={keptText(state.kept)} title="Kept recordings">
            <SettingsButton
              disabled={state.kept.count === 0}
              onClick={() => void handleDelete()}
              variant="ghost"
            >
              Delete kept recordings
            </SettingsButton>
          </SettingsRow>
        </>
      )}
      {state.tag === 'loading' && (
        <SettingsBlock role="status" tone="quiet">
          Loading…
        </SettingsBlock>
      )}
      {state.tag === 'error' && (
        <SettingsBlock role="alert" tone="error">
          {state.message}
        </SettingsBlock>
      )}
      {problem && (
        <SettingsBlock role="alert" tone="error">
          {problem}
        </SettingsBlock>
      )}
    </SettingsGroup>
  );
}
