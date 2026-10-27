import type { ModelRun } from '@/core/ipc';
import { formatPercent, formatSeconds, modelName } from '../../helpers/speech-check';

type Props = { runs: readonly ModelRun[]; modelInUse: string };

const HEADERS = ['Model', 'Prompt', 'Terms right', 'Word errors', 'Median', 'Slowest'];

export function ResultsTable({ runs, modelInUse }: Props) {
  return (
    <table className="text-caption w-full border-collapse">
      <caption className="sr-only">Speech recognition measured on your recordings</caption>
      <thead>
        <tr className="text-faint">
          {HEADERS.map((header) => (
            <th className="py-1.5 pr-3 text-left text-xs font-normal" key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr
            className="border-line-soft text-muted border-t"
            key={`${run.model_file}-${run.uses_prompt}`}
          >
            <th className="text-foreground py-1.5 pr-3 text-left font-semibold" scope="row">
              {modelName(run.model_file)}
              {run.model_file === modelInUse && !run.uses_prompt && (
                <span className="text-ok ml-1.5 text-xs font-normal">· in use</span>
              )}
            </th>
            <td className="py-1.5 pr-3">{run.uses_prompt ? 'Glossary' : 'None'}</td>
            <td className="py-1.5 pr-3 font-mono">
              {formatPercent(run.term_accuracy)} ({run.terms_found}/{run.terms_total})
            </td>
            <td className="py-1.5 pr-3 font-mono">{formatPercent(run.word_error_rate)}</td>
            <td className="py-1.5 pr-3 font-mono">{formatSeconds(run.median_ms)}</td>
            <td className="py-1.5 pr-3 font-mono">{formatSeconds(run.max_ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
