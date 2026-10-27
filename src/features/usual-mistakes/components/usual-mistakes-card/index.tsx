import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import type { UsualMistake } from '../../types';

type Props = {
  mistakes: readonly UsualMistake[];
  blockedReason: string | null;
  isStarting: boolean;
  onPractice: () => void;
};

const QUESTION_COUNT = 5;

export function UsualMistakesCard({ mistakes, blockedReason, isStarting, onPractice }: Props) {
  return (
    <GlassPanel aria-label="Your usual mistakes" className="flex flex-col gap-3 p-5">
      <h2 className="text-caption text-faint font-semibold">Your usual mistakes</h2>
      <ul className="text-control flex flex-col gap-2">
        {mistakes.map((mistake) => (
          <li className="flex justify-between gap-2" key={mistake.id}>
            <s className="text-muted decoration-warn/70">{mistake.original}</s>
            <span className="text-right">{mistake.corrected}</span>
          </li>
        ))}
      </ul>
      <Button
        className="w-full"
        disabled={blockedReason !== null}
        onClick={onPractice}
        pending={isStarting}
        tone="secondary"
      >
        {isStarting ? 'Preparing…' : `Practice ${QUESTION_COUNT} questions`}
      </Button>
      {blockedReason && <p className="text-faint text-xs">{blockedReason}</p>}
    </GlassPanel>
  );
}
