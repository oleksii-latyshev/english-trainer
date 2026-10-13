import type { ReactNode } from 'react';
import type { FirstRunStepId } from '@/core/first-run';
import { Eva, type EvaMood } from '@/shared/ui/eva';
import { stepCopy, stepLabel } from '../../helpers/step-copy';

type Props = { step: FirstRunStepId; mood: EvaMood; children: ReactNode };

export function StepLayout({ step, mood, children }: Props) {
  const copy = stepCopy(step);
  return (
    <>
      <div className="flex h-42 flex-col items-center justify-end">
        <Eva decorative mood={mood} size={132} />
      </div>
      <p className="mt-4 font-semibold text-faint text-xs">{stepLabel(step)}</p>
      <h1 className="mt-2 text-center font-bold text-3xl tracking-tight">{copy.title}</h1>
      <p className="mt-2 max-w-115 text-center text-body text-muted leading-copy">{copy.lead}</p>
      <div className="mt-8 w-full max-w-115">{children}</div>
    </>
  );
}
