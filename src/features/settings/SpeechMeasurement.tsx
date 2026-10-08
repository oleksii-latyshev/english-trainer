import { useState } from 'react';
import {
  type ModelRun,
  runSpeechCheck,
  type SpeechCheckProgress,
  type SpeechCheckStatus,
  type SpeechModel,
  speechErrorMessage,
} from '@/lib/speechTypes';
import { formatPercent, formatSeconds, modelName, progressText } from './lib/speechCheck';
import { SettingsButton, Switch } from './SettingsControls';
import { SettingsBlock, SettingsRow } from './SettingsGroup';

const ALL_MODELS = 'all';

type RunState =
  | { tag: 'idle' }
  | { tag: 'running'; progress?: SpeechCheckProgress }
  | { tag: 'error'; message: string };

function runTitle(run: ModelRun): string {
  return `${modelName(run.model_file)}${run.uses_prompt ? ' with glossary prompt' : ''}`;
}

function ResultsTable({ runs }: { runs: readonly ModelRun[] }) {
  return (
    <table className="speech-results">
      <caption className="sr-only">Speech recognition measured on your recordings</caption>
      <thead>
        <tr>
          <th scope="col">Model</th>
          <th scope="col">Prompt</th>
          <th scope="col">Terms right</th>
          <th scope="col">Word errors</th>
          <th scope="col">Median</th>
          <th scope="col">Slowest</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={`${run.model_file}-${run.uses_prompt}`}>
            <th scope="row">{modelName(run.model_file)}</th>
            <td>{run.uses_prompt ? 'Glossary' : 'None'}</td>
            <td>
              {formatPercent(run.term_accuracy)} ({run.terms_found}/{run.terms_total})
            </td>
            <td>{formatPercent(run.word_error_rate)}</td>
            <td>{formatSeconds(run.median_ms)}</td>
            <td>{formatSeconds(run.max_ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Transcripts({ run }: { run: ModelRun }) {
  return (
    <details className="settings-details settings-quiet">
      <summary>
        Transcripts: {runTitle(run)} ({run.recordings.length} recordings)
      </summary>
      <ol className="speech-transcripts">
        {run.recordings.map((recording) => (
          <li key={recording.index}>
            <p>
              <span className="speech-transcript-label">Read</span> {recording.reference}
            </p>
            <p>
              <span className="speech-transcript-label">Heard</span>{' '}
              {recording.transcript || '(nothing recognised)'}
            </p>
            <p className="settings-quiet">
              {formatSeconds(recording.time_ms)}
              {recording.terms_total > 0 &&
                ` · terms ${recording.terms_found}/${recording.terms_total}`}{' '}
              · errors {formatPercent(recording.word_error_rate)}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Measures the installed models on the recorded sentences and keeps the numbers until the next run. */
export function SpeechMeasurement({
  models,
  check,
  recordedCount,
  onMeasured,
}: {
  models: readonly SpeechModel[];
  check: SpeechCheckStatus;
  recordedCount: number;
  onMeasured: (check: SpeechCheckStatus) => void;
}) {
  const [target, setTarget] = useState(ALL_MODELS);
  const [includePrompt, setIncludePrompt] = useState(false);
  const [run, setRun] = useState<RunState>({ tag: 'idle' });
  const isRunning = run.tag === 'running';
  const canMeasure = models.length > 0 && recordedCount > 0 && !isRunning;

  async function handleMeasure() {
    const files = target === ALL_MODELS ? models.map((model) => model.file) : [target];
    setRun({ tag: 'running' });
    try {
      const results = await runSpeechCheck(files, includePrompt, (progress) =>
        setRun({ tag: 'running', progress }),
      );
      onMeasured({ ...check, results });
      setRun({ tag: 'idle' });
    } catch (cause) {
      setRun({
        tag: 'error',
        message: speechErrorMessage(cause, 'The measurement could not be completed. Try again.'),
      });
    }
  }

  return (
    <>
      <SettingsRow
        description={
          recordedCount === 0
            ? 'Record at least one sentence above first.'
            : 'Transcribes every recording with each model and compares it with the sentence you read.'
        }
        htmlFor="speech-measure-target"
        title="Measure models"
      >
        <select
          className="settings-select"
          disabled={isRunning || models.length === 0}
          id="speech-measure-target"
          onChange={(event) => {
            const value = event.target.value;
            setTarget(value);
          }}
          value={target}
        >
          <option value={ALL_MODELS}>Compare all models</option>
          {models.map((model) => (
            <option key={model.file} value={model.file}>
              {modelName(model.file)}
            </option>
          ))}
        </select>
        <SettingsButton disabled={!canMeasure} onClick={() => void handleMeasure()}>
          {isRunning ? 'Measuring…' : 'Measure'}
        </SettingsButton>
      </SettingsRow>
      <SettingsRow
        description="Also measures each model with your glossary as Whisper's initial prompt, to show how much it helps."
        title="Also try the glossary prompt"
      >
        <Switch
          checked={includePrompt}
          isDisabled={isRunning}
          label="Also try the glossary prompt"
          onChange={setIncludePrompt}
        />
      </SettingsRow>
      {run.tag === 'running' && (
        <SettingsBlock role="status" tone="quiet">
          <progress
            aria-label="Measurement progress"
            className="speech-progress"
            max={run.progress?.total ?? 1}
            value={run.progress?.done ?? 0}
          />
          <p>{run.progress ? progressText(run.progress) : 'Starting…'}</p>
        </SettingsBlock>
      )}
      {run.tag === 'error' && (
        <SettingsBlock role="alert" tone="error">
          {run.message}
        </SettingsBlock>
      )}
      {check.results.runs.length > 0 && (
        <SettingsBlock>
          <ResultsTable runs={check.results.runs} />
          <p className="settings-quiet speech-results-note">
            Time is the whole local Whisper run, including loading the model. Terms right counts
            glossary words found in the sentence you read.
          </p>
          {check.results.runs.map((item) => (
            <Transcripts key={`${item.model_file}-${item.uses_prompt}`} run={item} />
          ))}
        </SettingsBlock>
      )}
    </>
  );
}
