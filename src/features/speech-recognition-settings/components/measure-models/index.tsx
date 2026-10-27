import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import type { SpeechCheckStatus, SpeechModel } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { Select } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { MEASURE_FAILED, settledFailureMessage } from '../../helpers/failure-copy';
import { modelName, progressText } from '../../helpers/speech-check';
import { measureModelsAtom, measurementProgressAtom } from '../../model/atoms';
import { ResultsTable } from '../results-table';
import { RunTranscripts } from '../run-transcripts';

const ALL_MODELS = 'all';

type Props = {
  models: readonly SpeechModel[];
  check: SpeechCheckStatus;
  modelInUse: string;
};

export function MeasureModels({ models, check, modelInUse }: Props) {
  const [target, setTarget] = useState(ALL_MODELS);
  const [includePrompt, setIncludePrompt] = useState(false);
  const result = useAtomValue(measureModelsAtom);
  const measure = useAtomSet(measureModelsAtom);
  const progress = Option.getOrUndefined(useAtomValue(measurementProgressAtom));
  const isRunning = AsyncResult.isWaiting(result);
  const recordedCount = check.sentences.filter((sentence) => sentence.is_recorded).length;
  const canMeasure = models.length > 0 && recordedCount > 0 && !isRunning;
  const failure = settledFailureMessage(result, MEASURE_FAILED);
  const options = [
    { value: ALL_MODELS, label: 'Compare all models' },
    ...models.map((model) => ({ value: model.file, label: modelName(model.file) })),
  ];

  function handleMeasure() {
    const modelFiles = target === ALL_MODELS ? models.map((model) => model.file) : [target];
    measure({ modelFiles, includePrompt });
  }

  return (
    <>
      <FormRow
        description={
          recordedCount === 0
            ? 'Record at least one sentence above first.'
            : 'Transcribes every recording with each model and compares it with the sentence you read.'
        }
        htmlFor="speech-measure-target"
        title="Measure models"
      >
        <Select
          disabled={isRunning || models.length === 0}
          id="speech-measure-target"
          label="Measure models"
          onChange={setTarget}
          options={options}
          value={target}
        />
        <Button disabled={!canMeasure} onClick={handleMeasure} tone="secondary">
          {isRunning ? 'Measuring…' : 'Measure'}
        </Button>
      </FormRow>
      <FormRow
        description="Also measures each model with your glossary as Whisper's initial prompt, to show how much it helps."
        title="Also try the glossary prompt"
      >
        <Switch
          checked={includePrompt}
          disabled={isRunning}
          isLabelHidden
          label="Also try the glossary prompt"
          onCheckedChange={setIncludePrompt}
        />
      </FormRow>
      {isRunning && (
        <Notice role="status" tone="quiet">
          <progress
            aria-label="Measurement progress"
            className="mb-1.5 h-2 w-full"
            max={progress?.total ?? 1}
            value={progress?.done ?? 0}
          />
          <p>{progress ? progressText(progress) : 'Starting…'}</p>
        </Notice>
      )}
      {failure && (
        <Notice role="alert" tone="error">
          {failure}
        </Notice>
      )}
      {check.results.runs.length > 0 && (
        <Notice>
          <ResultsTable modelInUse={modelInUse} runs={check.results.runs} />
          <p className="text-faint my-2.5 text-xs">
            Time is the whole local Whisper run, including loading the model. Terms right counts
            glossary words found in the sentence you read.
          </p>
          {check.results.runs.map((run) => (
            <RunTranscripts key={`${run.model_file}-${run.uses_prompt}`} run={run} />
          ))}
        </Notice>
      )}
    </>
  );
}
