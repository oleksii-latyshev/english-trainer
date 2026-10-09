import { useState } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import { useTrainer } from '@/context/TrainerContext';
import { saveLiveTranscript, saveSpeechModel, speechErrorMessage } from '@/lib/speechTypes';
import { engineLabel, engineProblem, liveTranscriptDescription } from './lib/engineStatus';
import { modelOptionLabel, plainRun } from './lib/speechCheck';
import { Switch } from './SettingsControls';
import { SettingsBlock, SettingsGroup, SettingsRow } from './SettingsGroup';
import { SpeechCheckRecorder } from './SpeechCheckRecorder';
import { SpeechMeasurement } from './SpeechMeasurement';
import { useSpeechEngineStatus } from './useSpeechEngineStatus';
import { useSpeechRecognition } from './useSpeechRecognition';
import './settingsSpeech.css';

/** Which Whisper model transcribes the answers, and the speech check that measures them on your voice. */
export function SpeechSettings() {
  const { capture } = useTrainer();
  const { selectedDeviceId } = usePreferredMicrophone();
  const { state, update } = useSpeechRecognition();
  const [saveError, setSaveError] = useState<string>();

  async function handleSelectModel(file: string) {
    setSaveError(undefined);
    try {
      if (state.tag === 'ready') update({ settings: await saveSpeechModel(file) });
    } catch (cause) {
      setSaveError(speechErrorMessage(cause, 'The model choice could not be saved.'));
    }
  }

  async function handleLiveTranscript(isOn: boolean) {
    setSaveError(undefined);
    try {
      const settings = await saveLiveTranscript(isOn);
      if (state.tag === 'ready') update({ settings });
    } catch (cause) {
      setSaveError(speechErrorMessage(cause, 'The live transcript setting could not be saved.'));
    }
  }

  return (
    <SettingsGroup id="speech" title="Speech recognition">
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
      {state.tag === 'ready' && (
        <ReadyBody
          deviceId={selectedDeviceId}
          isMicrophoneBusy={!capture.canChangeSession}
          onLiveTranscript={(isOn) => void handleLiveTranscript(isOn)}
          onSelectModel={(file) => void handleSelectModel(file)}
          saveError={saveError}
          state={state}
          update={update}
        />
      )}
    </SettingsGroup>
  );
}

type ReadyState = Extract<ReturnType<typeof useSpeechRecognition>['state'], { tag: 'ready' }>;

function ReadyBody({
  state,
  update,
  deviceId,
  isMicrophoneBusy,
  saveError,
  onSelectModel,
  onLiveTranscript,
}: {
  state: ReadyState;
  update: ReturnType<typeof useSpeechRecognition>['update'];
  deviceId: string;
  isMicrophoneBusy: boolean;
  saveError: string | undefined;
  onSelectModel: (file: string) => void;
  onLiveTranscript: (isOn: boolean) => void;
}) {
  const { settings, models, check } = state.data;
  const engine = useSpeechEngineStatus(`${settings.model_file}|${settings.live_transcript}`);
  const chosenIsMissing = !models.models.some((model) => model.file === settings.model_file);
  const recordedCount = check.sentences.filter((sentence) => sentence.is_recorded).length;
  return (
    <>
      {models.override_path && (
        <SettingsBlock role="status" tone="warn">
          ENG_TRAINER_WHISPER_MODEL is set, so the app uses {models.override_path} whatever you
          choose here.
        </SettingsBlock>
      )}
      <SettingsRow
        description="Larger models recognise more words correctly but take longer. Measure them on your voice below, then choose."
        htmlFor="speech-model"
        title="Model"
      >
        <select
          className="settings-select"
          id="speech-model"
          onChange={(event) => {
            const file = event.target.value;
            onSelectModel(file);
          }}
          value={settings.model_file}
        >
          {chosenIsMissing && (
            <option value={settings.model_file}>{settings.model_file} (not installed)</option>
          )}
          {models.models.map((model) => (
            <option key={model.file} value={model.file}>
              {modelOptionLabel(model, plainRun(check.results.runs, model.file))}
            </option>
          ))}
        </select>
      </SettingsRow>
      {engine && (
        <SettingsRow
          description="The model stays in memory between answers, so an answer is transcribed in a fraction of a second."
          title="Model in memory"
        >
          <span role="status">{engineLabel(engine)}</span>
        </SettingsRow>
      )}
      {engine && engineProblem(engine) && (
        <SettingsBlock role="status" tone="warn">
          {engineProblem(engine)}
        </SettingsBlock>
      )}
      <SettingsRow
        description={liveTranscriptDescription(settings, engine)}
        title="Live transcript"
      >
        <Switch
          checked={settings.live_transcript}
          label="Live transcript"
          onChange={onLiveTranscript}
        />
      </SettingsRow>
      {saveError && (
        <SettingsBlock role="alert" tone="error">
          {saveError}
        </SettingsBlock>
      )}
      {models.models.length === 0 && (
        <SettingsBlock role="status" tone="warn">
          No models were found in the app's models folder. Put ggml-*.bin files there (see the
          README, Local transcription setup).
        </SettingsBlock>
      )}
      <SpeechCheckRecorder
        check={check}
        deviceId={deviceId}
        isDisabled={isMicrophoneBusy}
        onChange={(next) => update({ check: next })}
      />
      <SpeechMeasurement
        check={check}
        models={models.models}
        onMeasured={(next) => update({ check: next })}
        recordedCount={recordedCount}
      />
    </>
  );
}
