import type { SetupDiagnostics } from '@/lib/types';
import { SettingsButton } from './SettingsControls';

export type DiagnosticsState =
  | { tag: 'loading' }
  | { tag: 'ready'; data: SetupDiagnostics }
  | { tag: 'error'; message: string };

function DiagnosticLine({ label, check }: { label: string; check: SetupDiagnostics['agy_cli'] }) {
  const statusLabel = {
    available: 'Found',
    missing: 'Missing',
    unreadable: 'Cannot read',
  }[check.status];
  return (
    <div>
      <p>
        <strong>{label}</strong> · {statusLabel}
      </p>
      <p className="settings-mono">{check.path ?? 'Path not found'}</p>
      <p>{check.message}</p>
    </div>
  );
}

/** The detected Whisper, model and agy files: out of the way, but there when something fails. */
export function SetupDetails({
  state,
  onRecheck,
}: {
  state: DiagnosticsState;
  onRecheck: () => void;
}) {
  return (
    <details className="settings-details settings-quiet settings-setup">
      <summary>Setup details</summary>
      <div className="settings-details-body">
        {state.tag === 'loading' && <p role="status">Checking setup…</p>}
        {state.tag === 'error' && <p role="alert">{state.message}</p>}
        {state.tag === 'ready' && (
          <>
            <DiagnosticLine check={state.data.whisper_cli} label="Whisper command" />
            <DiagnosticLine check={state.data.whisper_model} label="Whisper model" />
            <DiagnosticLine check={state.data.agy_cli} label="agy command" />
            <div>
              <p>
                <strong>Local database</strong>
              </p>
              <p className="settings-mono">{state.data.database_path}</p>
            </div>
            {state.data.whisper_cli.status !== 'available' && (
              <p>
                Install the missing Whisper command with <code>brew install whisper.cpp</code>, then
                recheck.
              </p>
            )}
            {state.data.whisper_model.status !== 'available' && (
              <p>
                Follow the README’s Local transcription setup to install the English model at the
                path shown above, then recheck.
              </p>
            )}
            {state.data.agy_cli.status !== 'available' && (
              <p>
                Antigravity CLI powers coaching: install it and complete its sign-in flow (README,
                Personal Alpha setup), then recheck.
              </p>
            )}
          </>
        )}
        <div>
          <SettingsButton onClick={onRecheck} variant="ghost">
            Recheck files
          </SettingsButton>
        </div>
      </div>
    </details>
  );
}
