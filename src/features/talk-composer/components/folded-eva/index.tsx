import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { ChevronUp } from 'lucide-react';
import { evaStageAtom } from '@/core/eva-growth';
import { evaFoldedAtom } from '@/core/eva-look';
import { Button } from '@/shared/ui/button';
import { Eva } from '@/shared/ui/eva';
import { evaMoodFor } from '../../helpers/turn-state';
import { useTurn } from '../../model/use-composer';
import { flowSignalsAtom } from '../../model/view-atoms';

const AVATAR_SIZE = 36;

export function FoldedEva() {
  const { state, presentation } = useTurn();
  const stage = useAtomValue(evaStageAtom);
  const flow = useAtomValue(flowSignalsAtom);
  const setFolded = useAtomSet(evaFoldedAtom);
  return (
    <button
      aria-label="Unfold Eva"
      className="focus-visible:outline-accent shrink-0 cursor-pointer rounded-full transition-transform hover:scale-110 focus-visible:outline-2 motion-reduce:transition-none"
      onClick={() => setFolded(false)}
      type="button"
    >
      <span className="sr-only" role="status">
        Eva, {presentation.stageTitle.toLowerCase()}
      </span>
      <Eva
        label=""
        mood={evaMoodFor(state, flow, { isHelpOpen: false })}
        size={AVATAR_SIZE}
        stage={stage}
      />
    </button>
  );
}

export function FoldEvaButton() {
  const setFolded = useAtomSet(evaFoldedAtom);
  return (
    <Button aria-label="Fold Eva" iconOnly onClick={() => setFolded(true)} size="sm" tone="quiet">
      <ChevronUp aria-hidden="true" />
    </Button>
  );
}
