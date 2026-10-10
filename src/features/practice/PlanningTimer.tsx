import { Button } from '@heroui/react';

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
        <Button onPress={onCancel} size="sm" variant="ghost">
          Cancel planning
        </Button>
      </div>
    );
  }
  return (
    <div className="talk-help-actions">
      <span className="talk-help-text">Plan before you speak</span>
      <Button isDisabled={isDisabled} onPress={() => onStart(15)} size="sm" variant="secondary">
        15 seconds
      </Button>
      <Button isDisabled={isDisabled} onPress={() => onStart(30)} size="sm" variant="secondary">
        30 seconds
      </Button>
    </div>
  );
}
