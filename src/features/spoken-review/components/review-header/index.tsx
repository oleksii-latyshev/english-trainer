import { useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { endLabelOf, pipStateOf, progressLabel } from '../../helpers/header-copy';
import { isWarmupAtom, sessionAtom, shownItemAtom } from '../../model/session-atoms';
import { useReviewCommands } from '../../model/use-review-commands';
import { isEndingAtom } from '../../model/view-atoms';
import { pill, pip } from './styles';

type Props = {
  onBackToMemory: () => void;
};

export function ReviewHeader({ onBackToMemory }: Props) {
  const session = useAtomValue(sessionAtom);
  const shown = useAtomValue(shownItemAtom);
  const isEnding = useAtomValue(isEndingAtom);
  const isWarmup = useAtomValue(isWarmupAtom);
  const commands = useReviewCommands();
  const items = session?.run.items ?? [];
  const isDone = session?.step.tag === 'summary';
  const position = isDone ? null : (shown?.position ?? null);
  const label = endLabelOf({ isWarmup, isDone });

  return (
    <header className="flex h-13 items-center gap-3 px-1">
      <div className={pill}>
        <span className="text-caption text-faint">Memory</span>
        <span aria-hidden="true" className="text-faint">
          ›
        </span>
        <h1 className="text-body m-0 font-semibold">Spoken review</h1>
      </div>
      <div className={pill}>
        <span aria-hidden="true" className="flex gap-1.25">
          {items.map((item, index) => (
            <i className={pip({ state: pipStateOf(index, position) })} key={item.position} />
          ))}
        </span>
        <span className="font-semibold tabular-nums">{progressLabel(position, items.length)}</span>
        {!isDone && <span className="text-caption text-faint">· about 3 min</span>}
      </div>
      <Button
        className="ml-auto"
        disabled={isEnding}
        onClick={isDone ? onBackToMemory : () => commands.end(onBackToMemory)}
        size="sm"
        tone="secondary"
      >
        {label}
      </Button>
    </header>
  );
}
