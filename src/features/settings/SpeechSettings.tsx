import { useState } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import { useTrainer } from '@/context/TrainerContext';
import { saveLiveTranscript, saveSpeechModel, speechErrorMessage } from '@/lib/speechTypes';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { Switch } from '@/shared/ui/switch';
import { engineLabel, engineProblem, liveTranscriptDescription } from './lib/engineStatus';
import { modelOptionLabel, plainRun } from './lib/speechCheck';
import { SpeechCheckRecorder } from './SpeechCheckRecorder';
import { SpeechMeasurement } from './SpeechMeasurement';
import { useSpeechEngineStatus } from './useSpeechEngineStatus';
import { useSpeechRecognition } from './useSpeechRecognition';
import './settingsSpeech.css';
import { GroupCard } from '@/shared/ui/group-card';

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
    <GroupCard id="speech" title="Speech recognition">
      {state.tag === 'loading' && (
        <Notice role="status" tone="quiet">
          Loading…
        </Notice>
      )}
      {state.tag === 'error' && (
        <Notice role="alert" tone="error">
          {state.message}
        </Notice>
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
    </GroupCard>
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
        <Notice role="status" tone="warn">
          ENG_TRAINER_WHISPER_MODEL is set, so the app uses {models.override_path} whatever you
          choose here.
        </Notice>
      )}
      <FormRow
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
      </FormRow>
      {engine && (
        <FormRow
          description="The model stays in memory between answers, so an answer is transcribed in a fraction of a second."
          title="Model in memory"
        >
          <span role="status">{engineLabel(engine)}</span>
        </FormRow>
      )}
      {engine && engineProblem(engine) && (
        <Notice role="status" tone="warn">
          {engineProblem(engine)}
        </Notice>
      )}
      <FormRow description={liveTranscriptDescription(settings, engine)} title="Live transcript">
        <Switch
          checked={settings.live_transcript}
          isLabelHidden
          label="Live transcript"
          onCheckedChange={onLiveTranscript}
        />
      </FormRow>
      {saveError && (
        <Notice role="alert" tone="error">
          {saveError}
        </Notice>
      )}
      {models.models.length === 0 && (
        <Notice role="status" tone="warn">
          No models were found in the app's models folder. Put ggml-*.bin files there (see the
          README, Local transcription setup).
        </Notice>
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
