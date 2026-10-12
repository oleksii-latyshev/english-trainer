import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Eva } from '@/shared/ui/eva';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { moodName } from '../../helpers/mood-guide';
import { PREVIEW_STAGES, stageCaption } from '../../helpers/preview-caption';
import {
  growthAtom,
  pickPreviewStageAtom,
  previewMoodAtom,
  previewStageAtom,
} from '../../model/atoms';

export function EvaPreview() {
  const mood = useAtomValue(previewMoodAtom);
  const stage = useAtomValue(previewStageAtom);
  const { showGrowth } = useAtomValue(growthAtom);
  const pickStage = useAtomSet(pickPreviewStageAtom);
  return (
    <GlassPanel
      aria-label="Preview"
      className="relative flex w-82.5 flex-none flex-col items-center gap-0.5 overflow-hidden p-5 max-narrow:w-full"
    >
      <div className="flex h-68 items-end">
        <Eva
          label={`Eva preview, ${moodName(mood)}`}
          mood={mood}
          size={220}
          stage={showGrowth ? stage : null}
        />
      </div>
      <div className="mt-3.5 font-bold text-lg">{moodName(mood)}</div>
      <div className="text-caption text-faint">{stageCaption(stage, showGrowth)}</div>
      <SegmentedControl
        className="mt-auto"
        label="Growth stage"
        onChange={pickStage}
        options={PREVIEW_STAGES}
        size="md"
        value={showGrowth ? stage : undefined}
      />
    </GlassPanel>
  );
}
