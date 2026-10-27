import type { ComponentCheck } from '@/core/ipc';
import { pathLabel, statusLabel } from '../../helpers/diagnostic-status';

type Props = { label: string; check: ComponentCheck };

export function DiagnosticLine({ label, check }: Props) {
  return (
    <div>
      <p>
        <strong className="text-foreground">{label}</strong> · {statusLabel(check.status)}
      </p>
      <p className="text-foreground font-mono">{pathLabel(check.path)}</p>
      <p>{check.message}</p>
    </div>
  );
}
