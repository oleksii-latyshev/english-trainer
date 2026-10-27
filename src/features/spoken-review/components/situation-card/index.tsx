import { useAtomValue } from '@effect/atom-react';
import { Volume2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { canReplayAtom, phaseAtom, promptAtom } from '../../model/prompt-atoms';
import { useReviewCommands } from '../../model/use-review-commands';
import { isBusyAtom } from '../../model/view-atoms';

export function SituationCard() {
  const prompt = useAtomValue(promptAtom);
  const canReplay = useAtomValue(canReplayAtom);
  const phase = useAtomValue(phaseAtom);
  const isBusy = useAtomValue(isBusyAtom);
  const commands = useReviewCommands();
  if (prompt === null) return null;

  return (
    <div className="rounded-card border-line bg-surface shadow-overlay backdrop-blur-glass flex items-start gap-3.5 border px-4.5 py-4 backdrop-saturate-170">
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-accent-text text-pip font-bold tracking-wide uppercase">
          {prompt.label}
        </span>
        <p className="leading-copy m-0 text-lg font-medium">{prompt.text}</p>
      </div>
      <Button
        disabled={!canReplay || phase !== 'prompt' || isBusy}
        onClick={commands.replay}
        size="sm"
        tone="secondary"
      >
        <Volume2 aria-hidden="true" />
        Replay
      </Button>
    </div>
  );
}
