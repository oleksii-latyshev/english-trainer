import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import { mistakeGroupsAtom } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { progressLabel, ruleTitleOf } from '../../helpers/run-copy';
import { isSummary, positionOf } from '../../helpers/run-position';
import { cursorAtom, runAtom } from '../../model/atoms';

type Props = { runId: number };

export function RunHeader({ runId }: Props) {
  const registry = useContext(RegistryContext);
  const run = Option.getOrNull(AsyncResult.value(useAtomValue(runAtom(runId))));
  const cursor = useAtomValue(cursorAtom(runId));
  const groups = Option.getOrNull(AsyncResult.value(useAtomValue(mistakeGroupsAtom)));
  if (run === null) return null;
  const summary = isSummary(run, cursor);
  const position = positionOf(run, cursor);
  const current = run.items[position];
  const reached = summary ? run.items.length : position + 1;
  const label = summary
    ? 'Practice summary'
    : progressLabel(position, run.items.length, ruleTitleOf(groups, current?.rule_key ?? null));
  return (
    <div className="flex h-10 items-center gap-4">
      <span
        aria-label={`Exercise ${reached} of ${run.items.length}`}
        className="flex flex-none gap-1.5"
        role="img"
      >
        {run.items.map((item, index) => (
          <span
            className={`h-1.5 w-10 rounded-full ${index < reached ? 'bg-accent' : 'bg-quiet-line'}`}
            key={item.position}
          />
        ))}
      </span>
      <span className="text-muted">{label}</span>
      {!summary && (
        <Button
          className="ml-auto"
          onClick={() => registry.set(cursorAtom(runId), run.items.length)}
          size="sm"
          tone="secondary"
        >
          End practice
        </Button>
      )}
    </div>
  );
}
