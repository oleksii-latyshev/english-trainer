import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { mistakeGroupsAtom } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { usualRules } from '../../helpers/usual-rules';

type Props = { onOpen: () => void };

export function UsualMistakesCard({ onOpen }: Props) {
  const groups = Option.getOrNull(AsyncResult.value(useAtomValue(mistakeGroupsAtom)));
  const rules = groups ? usualRules(groups) : [];
  if (rules.length === 0) return null;
  return (
    <GlassPanel aria-label="Your usual mistakes" className="flex flex-col gap-3 p-5">
      <h2 className="text-caption text-faint font-semibold">Your usual mistakes</h2>
      <ul className="text-control m-0 flex list-none flex-col gap-2 p-0">
        {rules.map((rule) => (
          <li className="flex items-center justify-between gap-2" key={rule.key}>
            <span>{rule.title}</span>
            <Chip>{rule.count}</Chip>
          </li>
        ))}
      </ul>
      <Button className="w-full" onClick={onOpen} tone="secondary">
        Open Mistakes
      </Button>
    </GlassPanel>
  );
}
