import { reachedSteps, STEP_COUNT } from '../../helpers/ladder';

type Props = { ladderStep: number; isFixed: boolean };

export function StepDots({ ladderStep, isFixed }: Props) {
  const reached = reachedSteps(ladderStep, isFixed);
  return (
    <span
      aria-label={isFixed ? 'Fixed' : `Step ${reached} of ${STEP_COUNT}`}
      className="flex flex-none gap-1"
      role="img"
    >
      {Array.from({ length: STEP_COUNT }, (_, index) => (
        <span
          className={`h-1.5 w-4 rounded-full ${index < reached ? 'bg-accent' : 'bg-quiet-line'}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: the dots are a fixed ordered sequence
          key={index}
        />
      ))}
    </span>
  );
}
