import { Button } from '@/shared/ui/button';
import type { PlanningSeconds } from '../../types';

type Props = {
  remainingSeconds: number;
  isActive: boolean;
  isDisabled: boolean;
  onStart: (seconds: PlanningSeconds) => void;
  onCancel: () => void;
};

const ROW = 'flex flex-wrap items-center gap-2';
const TEXT = 'text-caption text-muted leading-normal';
const CHOICES: PlanningSeconds[] = [15, 30];

export function PlanningTimer({
  remainingSeconds,
  isActive,
  isDisabled,
  onStart,
  onCancel,
}: Props) {
  if (isActive) {
    return (
      <div aria-live="polite" className={ROW}>
        <span className={TEXT}>Planning time: {remainingSeconds}s</span>
        <Button onClick={onCancel} size="sm" tone="quiet">
          Cancel planning
        </Button>
      </div>
    );
  }
  return (
    <div className={ROW}>
      <span className={TEXT}>Plan before you speak</span>
      {CHOICES.map((seconds) => (
        <Button
          disabled={isDisabled}
          key={seconds}
          onClick={() => onStart(seconds)}
          size="sm"
          tone="secondary"
        >
          {seconds} seconds
        </Button>
      ))}
    </div>
  );
}
