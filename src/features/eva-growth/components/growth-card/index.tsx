import { useAtomValue } from '@effect/atom-react';
import { growthPreferenceAtom, knownGrowthAtom } from '@/core/eva-growth';
import { CardButton } from '@/shared/ui/card-button';
import { ProgressBar } from '@/shared/ui/progress-bar';
import { stageProgress } from '../../helpers/growth-copy';

type Props = {
  disabled: boolean;
  onOpen: () => void;
};

export function GrowthCard({ disabled, onOpen }: Props) {
  const { showGrowth } = useAtomValue(growthPreferenceAtom);
  const growth = useAtomValue(knownGrowthAtom);
  if (!showGrowth || growth === null) return null;
  const progress = stageProgress(growth);

  return (
    <CardButton
      aria-label={`Eva's growth: ${progress.stageName}, ${progress.footer}`}
      className="max-rail:hidden"
      disabled={disabled}
      onClick={onOpen}
    >
      <span className="text-caption text-quiet-foreground flex items-center justify-between font-semibold">
        <span>{progress.stageName}</span>
        <span className="text-faint font-medium">{progress.counts}</span>
      </span>
      <ProgressBar
        label="Progress in this stage"
        max={progress.max}
        size="sm"
        value={progress.value}
      />
      <span className="text-caption text-faint">{progress.footer}</span>
    </CardButton>
  );
}
