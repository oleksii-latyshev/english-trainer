import { SegmentedControl } from '@/shared/ui/segmented-control';
import { LENGTH_CHOICES } from '../../constants';
import type { DurationGoalSeconds } from '../../types';

const NO_LIMIT = 'no-limit' as const;

type Props = {
  value: DurationGoalSeconds;
  onChange: (duration: DurationGoalSeconds) => void;
  disabled: boolean;
};

const OPTIONS = LENGTH_CHOICES.map((choice) => ({
  value: choice.value ?? NO_LIMIT,
  label: choice.label,
}));

export function LengthChoice({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-caption text-faint font-semibold">Length</span>
      <SegmentedControl
        disabled={disabled}
        label="Suggested session length"
        onChange={(picked) => onChange(picked === NO_LIMIT ? null : picked)}
        options={OPTIONS}
        size="md"
        value={value ?? NO_LIMIT}
      />
    </div>
  );
}
