import { Button } from '@/shared/ui/button';

export function PlanningTimer({
  remainingSeconds,
  isActive,
  isDisabled,
  onStart,
  onCancel,
}: {
  remainingSeconds: number;
  isActive: boolean;
  isDisabled: boolean;
  onStart: (seconds: number) => void;
  onCancel: () => void;
}) {
  if (isActive) {
    return (
      <div aria-live="polite" className="talk-help-actions">
        <span className="talk-help-text">Planning time: {remainingSeconds}s</span>
        <Button onClick={onCancel} size="sm" tone="quiet">
          Cancel planning
        </Button>
      </div>
    );
  }
  return (
    <div className="talk-help-actions">
      <span className="talk-help-text">Plan before you speak</span>
      <Button disabled={isDisabled} onClick={() => onStart(15)} size="sm" tone="secondary">
        15 seconds
      </Button>
      <Button disabled={isDisabled} onClick={() => onStart(30)} size="sm" tone="secondary">
        30 seconds
      </Button>
    </div>
  );
}
