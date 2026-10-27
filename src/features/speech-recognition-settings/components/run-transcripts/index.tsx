import type { ModelRun } from '@/core/ipc';
import { Disclosure } from '@/shared/ui/disclosure';
import { formatPercent, formatSeconds, runTitle } from '../../helpers/speech-check';

type Props = { run: ModelRun };

export function RunTranscripts({ run }: Props) {
  return (
    <Disclosure
      className="border-t-0 px-0 py-2"
      summary={`Transcripts: ${runTitle(run)} (${run.recordings.length} recordings)`}
    >
      <ol className="m-0 flex list-decimal flex-col gap-3 pl-5">
        {run.recordings.map((recording) => (
          <li key={recording.index}>
            <p>
              <span className="text-faint inline-block min-w-11 text-xs">Read</span>{' '}
              <span className="text-foreground">{recording.reference}</span>
            </p>
            <p>
              <span className="text-faint inline-block min-w-11 text-xs">Heard</span>{' '}
              <span className="text-foreground">
                {recording.transcript || '(nothing recognised)'}
              </span>
            </p>
            <p className="text-faint text-xs">
              {formatSeconds(recording.time_ms)}
              {recording.terms_total > 0 &&
                ` · terms ${recording.terms_found}/${recording.terms_total}`}{' '}
              · errors {formatPercent(recording.word_error_rate)}
            </p>
          </li>
        ))}
      </ol>
    </Disclosure>
  );
}
