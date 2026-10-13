import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { startLabel } from '../../helpers/start-label';
import type { PracticeMode, StartStatus } from '../../types';

type Props = {
  mode: PracticeMode;
  status: StartStatus;
  canStart: boolean;
  onStart: () => void;
  onRandom: () => void;
};

export function StartBar({ mode, status, canStart, onStart, onRandom }: Props) {
  const isIdle = status === 'ready';
  return (
    <div className="ml-auto flex items-center gap-3">
      <Button disabled={!isIdle} onClick={onRandom} tone="quiet">
        Random topic
      </Button>
      <Button disabled={!isIdle || !canStart} onClick={onStart} tone="primary">
        {startLabel(mode, status)}
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}
