import type { RescueKind } from '@/core/ipc';
import { Button } from '@/shared/ui/button';

type Props = {
  kind: RescueKind;
  isLoading: boolean;
  onChoose: (kind: RescueKind) => void;
};

const MODES: readonly { readonly kind: RescueKind; readonly label: string }[] = [
  { kind: 'next_step', label: 'Next step' },
  { kind: 'simpler', label: 'Say it simpler' },
  { kind: 'missing_word', label: 'Missing word' },
];

export function RescueModes({ kind, isLoading, onChoose }: Props) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1.5 border-0 p-0">
      <legend className="sr-only">Rescue type</legend>
      {MODES.map((mode) => (
        <Button
          disabled={isLoading}
          key={mode.kind}
          onClick={() => onChoose(mode.kind)}
          size="sm"
          tone={kind === mode.kind ? 'secondary' : 'quiet'}
        >
          {mode.label}
        </Button>
      ))}
    </fieldset>
  );
}
