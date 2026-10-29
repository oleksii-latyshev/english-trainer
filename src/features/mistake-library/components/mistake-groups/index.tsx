import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { TriangleAlert } from 'lucide-react';
import { mistakeGroupsAtom } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Notice } from '@/shared/ui/notice';
import { NOT_SORTED_HINT, NOT_SORTED_TITLE, totalMistakes } from '../../helpers/group-copy';
import { MistakeRow } from '../mistake-row';
import { RuleGroup } from '../rule-group';

type Props = { onOpen: (id: number) => void };

function EmptyState() {
  return (
    <GlassPanel className="text-caption text-faint flex flex-col items-center gap-1 px-5 py-12 text-center">
      <div className="text-body text-foreground font-semibold">No mistakes yet</div>
      <div>After a conversation review, the mistakes Eva noticed appear here as short lessons.</div>
    </GlassPanel>
  );
}

export function MistakeGroups({ onOpen }: Props) {
  const result = useAtomValue(mistakeGroupsAtom);
  const retry = useAtomRefresh(mistakeGroupsAtom);
  return AsyncResult.match(result, {
    onInitial: () => (
      <Notice role="status" tone="quiet">
        Loading your mistakes…
      </Notice>
    ),
    onFailure: () => (
      <Notice className="rounded-control flex items-center gap-3 border" role="alert" tone="quiet">
        <TriangleAlert aria-hidden="true" size={18} />
        <span className="flex-1">Could not load your mistakes from local storage.</span>
        <Button onClick={retry} size="sm" tone="secondary">
          Try again
        </Button>
      </Notice>
    ),
    onSuccess: ({ value }) => {
      if (totalMistakes(value) === 0) return <EmptyState />;
      return (
        <div className="max-narrow:grid-cols-1 grid grid-cols-2 items-start gap-4">
          {value.groups.map((group) => (
            <RuleGroup group={group} key={group.rule_key} onOpen={onOpen} />
          ))}
          {value.ungrouped.length > 0 && (
            <GlassPanel aria-labelledby="rule-not-sorted" className="flex flex-col gap-3 px-6 py-5">
              <h2 className="text-body m-0 font-bold" id="rule-not-sorted">
                {NOT_SORTED_TITLE}
              </h2>
              <p className="text-control text-muted m-0">{NOT_SORTED_HINT}</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {value.ungrouped.map((mistake) => (
                  <li key={mistake.id}>
                    <MistakeRow mistake={mistake} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            </GlassPanel>
          )}
        </div>
      );
    },
  });
}
