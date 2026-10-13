import { TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';

type Props = {
  message: string;
  onRetry?: () => void;
  isRetryDisabled?: boolean;
};

export function StartError({ message, onRetry, isRetryDisabled = false }: Props) {
  return (
    <Notice role="alert" tone="warn">
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button disabled={isRetryDisabled} onClick={onRetry} size="sm" tone="secondary">
          Try again
        </Button>
      )}
    </Notice>
  );
}
