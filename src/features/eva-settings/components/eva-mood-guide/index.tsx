import { useAtom, useAtomValue } from '@effect/atom-react';
import { ChoiceTile } from '@/shared/ui/choice-tile';
import { Eva } from '@/shared/ui/eva';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { EVA_MOOD_GUIDE } from '../../helpers/mood-guide';
import { growthAtom, previewMoodAtom, previewStageAtom } from '../../model/atoms';

export function EvaMoodGuide() {
  const [selected, setSelected] = useAtom(previewMoodAtom);
  const stage = useAtomValue(previewStageAtom);
  const { showGrowth } = useAtomValue(growthAtom);
  return (
    <GlassPanel aria-labelledby="eva-moods-heading" className="flex flex-col gap-1.5 px-5.5 py-4">
      <div className="flex items-baseline gap-3">
        <h2 className="font-bold" id="eva-moods-heading">
          What Eva's face means
        </h2>
        <span className="text-caption text-faint">Click one to preview it</span>
      </div>
      <ul className="grid grid-cols-6 gap-2 max-narrow:grid-cols-3">
        {EVA_MOOD_GUIDE.map((entry) => (
          <li key={entry.mood}>
            <ChoiceTile
              className="w-full"
              isSelected={selected === entry.mood}
              onSelect={() => setSelected(entry.mood)}
            >
              <Eva decorative mood={entry.mood} size={64} stage={showGrowth ? stage : null} />
              <span className="font-semibold text-caption">{entry.name}</span>
              <span className="text-faint text-xs">{entry.when}</span>
            </ChoiceTile>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
