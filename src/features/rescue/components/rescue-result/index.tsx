import { Button } from '@/shared/ui/button';
import { RESCUE_LOADING, rescueFailureMessage } from '../../helpers/rescue-copy';
import type { RescueState } from '../../types';

type Props = {
  state: RescueState;
  onSelect: (term: string) => void;
  onRetry: () => void;
};

const TEXT = 'm-0 text-control text-foreground leading-normal';

export function RescueResult({ state, onSelect, onRetry }: Props) {
  if (state.tag === 'loading') {
    return (
      <p className={TEXT} role="status">
        {RESCUE_LOADING}
      </p>
    );
  }
  if (state.tag === 'selected') {
    return (
      <p className={TEXT} role="status">
        {state.term}
      </p>
    );
  }
  if (state.tag === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-foreground text-xs" role="alert">
        <span>{rescueFailureMessage(state.failure)}</span>
        <Button onClick={onRetry} size="sm" tone="secondary">
          Retry
        </Button>
      </div>
    );
  }
  if (state.tag !== 'answer') return null;
  if (state.answer.kind === 'missing_word') {
    return (
      <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1.5 border-0 p-0">
        <legend className="sr-only">Word suggestions</legend>
        {state.answer.candidates.map((candidate) => (
          <Button key={candidate} onClick={() => onSelect(candidate)} size="sm" tone="quiet">
            {candidate}
          </Button>
        ))}
      </fieldset>
    );
  }
  return (
    <p className={TEXT} role="status">
      {state.answer.suggestion}
    </p>
  );
}
