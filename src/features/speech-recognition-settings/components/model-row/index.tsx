import { useAtomSet, useAtomValue } from '@effect/atom-react';
import type { SpeechCheckStatus, SpeechModels, SpeechSettings } from '@/core/ipc';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { Select } from '@/shared/ui/select';
import { MODEL_SAVE_FAILED, settledFailureMessage } from '../../helpers/failure-copy';
import { modelOptionLabel, plainRun } from '../../helpers/speech-check';
import { saveSpeechModelAtom } from '../../model/atoms';

type Props = {
  settings: SpeechSettings;
  models: SpeechModels;
  check: SpeechCheckStatus;
};

export function ModelRow({ settings, models, check }: Props) {
  const save = useAtomSet(saveSpeechModelAtom);
  const saveFailure = settledFailureMessage(useAtomValue(saveSpeechModelAtom), MODEL_SAVE_FAILED);
  const installed = models.models.map((model) => ({
    value: model.file,
    label: modelOptionLabel(model, plainRun(check.results.runs, model.file)),
  }));
  const isMissing = !models.models.some((model) => model.file === settings.model_file);
  const options = isMissing
    ? [
        { value: settings.model_file, label: `${settings.model_file} (not installed)` },
        ...installed,
      ]
    : installed;
  return (
    <>
      <FormRow
        description="Larger models recognise more words correctly but take longer. Measure them on your voice below, then choose."
        htmlFor="speech-model"
        title="Model"
      >
        <Select
          id="speech-model"
          label="Model"
          onChange={save}
          options={options}
          value={settings.model_file}
        />
      </FormRow>
      {saveFailure && (
        <Notice role="alert" tone="error">
          {saveFailure}
        </Notice>
      )}
    </>
  );
}
