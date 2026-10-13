import { SegmentedControl } from '@/shared/ui/segmented-control';
import { LENGTH_CHOICES } from '../../constants';
import type { DurationGoalSeconds } from '../../types';

type Props = {
  value: DurationGoalSeconds;
  onChange: (duration: DurationGoalSeconds) => void;
  disabled: boolean;
};

export function LengthChoice({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-semibold text-caption text-faint">Length</span>
      <SegmentedControl
        disabled={disabled}
        label="Suggested session length"
        onChange={onChange}
        options={LENGTH_CHOICES}
        size="md"
        value={value}
      />
    </div>
  );
}
