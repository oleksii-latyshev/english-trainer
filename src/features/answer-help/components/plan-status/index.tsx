import { Button } from '@/shared/ui/button';
import { PREPARING, planFailureMessage } from '../../helpers/help-copy';
import type { PlanState } from '../../types';

type Props = {
  plan: Exclude<PlanState, { tag: 'ready' }>;
  onRetry: () => void;
};

export function PlanStatus({ plan, onRetry }: Props) {
  if (plan.tag === 'loading') {
    return <p className="text-caption text-muted m-0 leading-normal">{PREPARING}</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption text-muted m-0 leading-normal" role="status">
        {planFailureMessage(plan.failure)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry} size="sm" tone="secondary">
          Retry help
        </Button>
      </div>
    </div>
  );
}
