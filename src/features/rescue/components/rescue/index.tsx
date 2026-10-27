import type { RescueKind } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { Kbd } from '@/shared/ui/kbd';
import { useRescue } from '../../model/use-rescue';
import type { RescueState } from '../../types';
import { MissingWordForm } from '../missing-word-form';
import { RescueModes } from '../rescue-modes';
import { RescueResult } from '../rescue-result';

function visibleKind(state: RescueState): RescueKind {
  if (state.tag === 'loading' || state.tag === 'answer' || state.tag === 'error') {
    return state.kind;
  }
  if (state.tag === 'missing-word' || state.tag === 'selected') return 'missing_word';
  return 'next_step';
}

export function Rescue() {
  const rescue = useRescue();
  const { state } = rescue;

  if (state.tag === 'closed') {
    return (
      <Button aria-keyshortcuts="S" onClick={rescue.open} size="sm" tone="secondary">
        Stuck <Kbd>S</Kbd>
      </Button>
    );
  }

  return (
    <section
      aria-label="Stuck rescue"
      className="border-line bg-surface flex max-w-[min(420px,45vw)] flex-col gap-2 rounded-2xl border px-3 py-2.5"
    >
      <div className="text-caption text-foreground flex items-center justify-between gap-1.5">
        <strong>Need a little help?</strong>
        <Button onClick={rescue.close} size="sm" tone="quiet">
          Continue speaking
        </Button>
      </div>
      <RescueModes
        isLoading={state.tag === 'loading'}
        kind={visibleKind(state)}
        onChoose={rescue.choose}
      />
      {state.tag === 'missing-word' && (
        <MissingWordForm
          description={state.description}
          onChange={rescue.describe}
          onFind={rescue.find}
        />
      )}
      <RescueResult onRetry={rescue.retry} onSelect={rescue.select} state={state} />
    </section>
  );
}
