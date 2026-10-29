import { ladderSteps } from '../../helpers/ladder';

type Props = { ladderStep: number; isFixed: boolean };

export function LadderLine({ ladderStep, isFixed }: Props) {
  return (
    <ol aria-label="Practice steps" className="m-0 flex list-none flex-wrap gap-2 p-0">
      {ladderSteps(ladderStep, isFixed).map((step) => (
        <li
          aria-current={step.state === 'current' ? 'step' : undefined}
          className={`text-caption rounded-full border px-3.5 py-1 ${STATE_CLASS[step.state]}`}
          key={step.number}
        >
          {step.number} {step.label}
        </li>
      ))}
    </ol>
  );
}

const STATE_CLASS = {
  done: 'border-ok-line text-ok-text',
  current: 'border-accent-line bg-accent-soft text-accent-text',
  todo: 'border-line text-faint',
} as const;
