import { useAtomValue } from '@effect/atom-react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { FIX_LABEL } from '../../helpers/turn-issue';
import { type FixHandlers, runFix } from '../../model/commands';
import { useComposerRegistry } from '../../model/use-composer';
import { turnStateAtom } from '../../model/view-atoms';

export function TurnNotice(handlers: FixHandlers) {
  const state = useAtomValue(turnStateAtom);
  const registry = useComposerRegistry();
  if (state.tag !== 'error') return null;
  const { issue } = state;
  return (
    <Notice
      className="flex flex-wrap items-center gap-3 rounded-control border border-warn-line"
      role="alert"
      tone="warn"
    >
      <TriangleAlert aria-hidden="true" className="size-4.5 shrink-0" />
      <span className="min-w-0 flex-1">{issue.message}</span>
      {issue.fixes.map((fix, index) => (
        <Button
          key={fix}
          onClick={() => runFix(registry, fix, handlers)}
          size="sm"
          tone={index === 0 ? 'secondary' : 'quiet'}
        >
          {FIX_LABEL[fix]}
        </Button>
      ))}
    </Notice>
  );
}
