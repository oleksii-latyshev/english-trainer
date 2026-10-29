import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { ChevronDown } from 'lucide-react';
import { evaStageAtom } from '@/core/eva-growth';
import { evaFoldedAtom } from '@/core/eva-look';
import { Button } from '@/shared/ui/button';
import { Eva } from '@/shared/ui/eva';
import { evaMoodFor } from '../../helpers/turn-state';
import { useTurn } from '../../model/use-composer';
import { flowSignalsAtom } from '../../model/view-atoms';

const AVATAR_SIZE = 32;

export function FoldedEva() {
  const { state, presentation } = useTurn();
  const stage = useAtomValue(evaStageAtom);
  const flow = useAtomValue(flowSignalsAtom);
  const setFolded = useAtomSet(evaFoldedAtom);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-2" role="status">
        <Eva
          label={`Eva, ${presentation.stageTitle.toLowerCase()}`}
          mood={evaMoodFor(state, flow, { isHelpOpen: false })}
          size={AVATAR_SIZE}
          stage={stage}
        />
        <span className="text-caption text-muted whitespace-nowrap">
          {presentation.stageLabel} · {presentation.stageTitle}
        </span>
      </div>
      <Button
        aria-label="Unfold Eva"
        iconOnly
        onClick={() => setFolded(false)}
        size="sm"
        tone="quiet"
      >
        <ChevronDown aria-hidden="true" />
      </Button>
    </div>
  );
}
