import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { SetupDiagnostics } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { Disclosure } from '@/shared/ui/disclosure';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { SETUP_UNREADABLE } from '../../helpers/diagnostic-status';
import { setupDiagnosticsAtom } from '../../model/atoms';
import { DiagnosticLine } from '../diagnostic-line';

type Props = {
  onRunSetupAgain: () => void;
  setupDisabledReason?: string;
};

function Findings({ data }: { data: SetupDiagnostics }) {
  return (
    <>
      <DiagnosticLine check={data.whisper_cli} label="Whisper command" />
      <DiagnosticLine check={data.whisper_server} label="Whisper server" />
      {data.whisper_backend && (
        <p>
          <strong className="text-foreground">Whisper backend</strong>{' '}
          {data.whisper_backend === 'cuda' ? 'CUDA (GPU)' : 'CPU'}
        </p>
      )}
      <DiagnosticLine check={data.whisper_model} label="Whisper model" />
      <DiagnosticLine check={data.claude_cli} label="claude command" />
      <div>
        <p>
          <strong className="text-foreground">Local database</strong>
        </p>
        <p className="text-foreground font-mono">{data.database_path}</p>
      </div>
      {data.whisper_cli.status !== 'available' && (
        <p>
          Install the missing Whisper command with <code>brew install whisper.cpp</code>, then
          recheck.
        </p>
      )}
      {data.whisper_model.status === 'missing' && (
        <p>
          Download the speech model in Settings › Speech recognition, then recheck. You can also
          place the English model at the path shown above.
        </p>
      )}
      {data.whisper_model.status === 'unreadable' && (
        <p>Check the permissions of the model at the path shown above, then recheck.</p>
      )}
      {data.claude_cli.status !== 'available' && (
        <p>
          Claude Code powers coaching and reviews: install it and sign in once with{' '}
          <code>claude</code>, then recheck.
        </p>
      )}
    </>
  );
}

export function SetupDetails({ onRunSetupAgain, setupDisabledReason }: Props) {
  const result = useAtomValue(setupDiagnosticsAtom);
  const recheck = useAtomRefresh(setupDiagnosticsAtom);
  const data = Option.getOrUndefined(AsyncResult.value(result));
  const isChecking = AsyncResult.isWaiting(result);
  const hasFailed = !isChecking && AsyncResult.isFailure(result);
  return (
    <GlassPanel>
      <Disclosure summary="Setup details">
        {isChecking && <p role="status">Checking setup…</p>}
        {hasFailed && <p role="alert">{SETUP_UNREADABLE}</p>}
        {!isChecking && data && <Findings data={data} />}
        <div className="flex gap-2">
          <Button onClick={recheck} tone="ghost">
            Recheck files
          </Button>
          <Button
            disabled={setupDisabledReason !== undefined}
            onClick={onRunSetupAgain}
            tone="ghost"
          >
            Run setup again
          </Button>
        </div>
        {setupDisabledReason && <p role="status">{setupDisabledReason}</p>}
      </Disclosure>
    </GlassPanel>
  );
}
