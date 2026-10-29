import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { mistakeGroupsAtom } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { Tooltip } from '@/shared/ui/tooltip';
import { practiseLabel } from '../../helpers/group-copy';

type Props = {
  blockedReason: string | null;
  isStarting: boolean;
  error: string;
  onTalkItThrough: () => void;
};

export const COMING_SOON = 'Coming soon';

export function PracticeActions({ blockedReason, isStarting, error, onTalkItThrough }: Props) {
  const groups = Option.getOrNull(AsyncResult.value(useAtomValue(mistakeGroupsAtom)));
  const dueCount = groups?.due_count ?? 0;
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          disabled={blockedReason !== null}
          onClick={onTalkItThrough}
          pending={isStarting}
          tone="secondary"
        >
          {isStarting ? 'Preparing…' : 'Talk it through'}
        </Button>
        <Tooltip content={COMING_SOON}>
          <Button disabled tone="primary">
            {practiseLabel(dueCount)}
          </Button>
        </Tooltip>
      </div>
      {blockedReason && <p className="text-faint m-0 text-xs">{blockedReason}</p>}
      {error && (
        <p className="text-warn-text m-0 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
