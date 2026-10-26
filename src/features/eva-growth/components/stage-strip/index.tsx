import { useAtomValue } from '@effect/atom-react';
import { knownGrowthAtom, toEvaStage } from '@/core/eva-growth';
import { Eva } from '@/shared/ui/eva';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { type StripState, stageStrip } from '../../helpers/growth-copy';

const DOT: Record<StripState, string> = {
  reached: 'border-accent bg-accent',
  here: 'border-accent bg-background',
  ahead: 'border-quiet-line bg-background',
};

function lineTone(isReached: boolean): string {
  return isReached ? 'bg-accent' : 'bg-quiet-line';
}

export function StageStrip() {
  const growth = useAtomValue(knownGrowthAtom);
  const current = toEvaStage(growth?.stage ?? 0);
  const entries = stageStrip(current);

  return (
    <GlassPanel aria-labelledby="growth-heading" className="flex flex-col gap-6 px-7 py-6">
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="font-bold text-2xl tracking-tight" id="growth-heading">
          Eva grows as you speak
        </h1>
        <span className="text-muted">One minute spoken = one drop. Nothing ever wilts.</span>
      </div>
      <ol className="m-0 grid list-none grid-cols-6 gap-3 p-0 max-narrow:grid-cols-3">
        {entries.map((entry) => (
          <li
            aria-current={entry.state === 'here' ? 'step' : undefined}
            className="flex flex-col items-center"
            key={entry.stage}
          >
            <Eva decorative mood={entry.mood} size={84} stage={entry.stage} />
            <span aria-hidden="true" className="mt-4 flex w-full items-center">
              <span
                className={`h-0.75 flex-1 rounded-full ${entry.stage === 0 ? 'bg-transparent' : lineTone(entry.state !== 'ahead')}`}
              />
              <span className={`size-3.5 flex-none rounded-full border-2 ${DOT[entry.state]}`} />
              <span
                className={`h-0.75 flex-1 rounded-full ${entry.stage === 5 ? 'bg-transparent' : lineTone(entry.state === 'reached')}`}
              />
            </span>
            <span className="mt-3 font-bold text-body">{entry.name}</span>
            <span className="text-caption text-faint">{entry.need}</span>
            <span className="mt-1.5 min-h-4 font-bold text-accent-text text-xs">
              {entry.marker}
            </span>
          </li>
        ))}
      </ol>
    </GlassPanel>
  );
}
