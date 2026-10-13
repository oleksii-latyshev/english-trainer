import type { StepProgress } from '@/core/first-run';
import { stepBar } from './styles';

type Props = { steps: readonly StepProgress[] };

export function StepBars({ steps }: Props) {
  return (
    <ol aria-label="Setup steps" className="m-0 flex list-none items-center gap-2 p-0">
      {steps.map((step) => (
        <li aria-current={step.status === 'current' ? 'step' : undefined} key={step.id}>
          <span className={stepBar({ status: step.status })} />
          <span className="sr-only">
            {step.label}
            {step.status === 'done' ? ', done' : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}
