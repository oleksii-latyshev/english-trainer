import type { MistakeSummary } from '@/core/mistakes';
import { CardButton } from '@/shared/ui/card-button';
import { MarkedSentence } from '../marked-sentence';
import { StepDots } from '../step-dots';

type Props = { mistake: MistakeSummary; onOpen: (id: number) => void };

export function MistakeRow({ mistake, onOpen }: Props) {
  return (
    <CardButton
      aria-label={`${mistake.said} → ${mistake.corrected}`}
      className="text-control flex-row items-center justify-between gap-3"
      onClick={() => onOpen(mistake.id)}
    >
      <span>
        <s className="text-muted decoration-warn/70">{mistake.said}</s>
        <span aria-hidden="true"> → </span>
        <MarkedSentence corrected={mistake.corrected} said={mistake.said} />
      </span>
      <StepDots isFixed={mistake.is_fixed} ladderStep={mistake.ladder_step} />
    </CardButton>
  );
}
