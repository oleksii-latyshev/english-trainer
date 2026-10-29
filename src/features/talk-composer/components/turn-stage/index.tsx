import { useAtom, useAtomValue } from '@effect/atom-react';
import { ChevronUp } from 'lucide-react';
import { usePreferredMicrophone } from '@/core/audio';
import { evaStageAtom } from '@/core/eva-growth';
import { evaFoldedAtom } from '@/core/eva-look';
import { micLevelAtom } from '@/core/practice-turn';
import { Button } from '@/shared/ui/button';
import { Eva } from '@/shared/ui/eva';
import { evaMoodFor, type MoodExtras } from '../../helpers/turn-state';
import { useTurn } from '../../model/use-composer';
import { flowSignalsAtom, isComposingAtom } from '../../model/view-atoms';

type Props = {
  mood: MoodExtras;
  isWriting: boolean;
};

const ACTOR_TONE = {
  learner: 'text-accent-text',
  eva: 'text-ok-text',
  neutral: 'text-muted',
} as const;

function WritingStage() {
  return (
    <aside aria-label="Writing practice" className="flex flex-col items-center gap-1 text-center">
      <h2 className="text-title m-0 font-bold">Write your answer</h2>
      <p className="text-caption text-muted m-0">
        Take your time. Eva’s replies will stay on screen.
      </p>
    </aside>
  );
}

export function TurnStage({ mood, isWriting }: Props) {
  const { state, presentation } = useTurn();
  const stage = useAtomValue(evaStageAtom);
  const flow = useAtomValue(flowSignalsAtom);
  const audioLevel = useAtomValue(micLevelAtom);
  const isCompact = useAtomValue(isComposingAtom) || mood.isHelpOpen;
  const { actualInput } = usePreferredMicrophone();
  const [isFolded, setFolded] = useAtom(evaFoldedAtom);
  if (isWriting) return <WritingStage />;
  if (isFolded) return null;
  return (
    <aside
      aria-label="Eva"
      className="short:gap-1 pointer-events-none relative z-10 flex flex-col items-center gap-3"
    >
      <Button
        aria-label="Fold Eva"
        className="pointer-events-auto absolute top-0 right-6"
        iconOnly
        onClick={() => setFolded(true)}
        size="sm"
        tone="quiet"
      >
        <ChevronUp aria-hidden="true" />
      </Button>
      <div
        className={`origin-top transition-[transform,margin] duration-200 motion-reduce:transition-none ${isCompact ? '-mb-16 scale-60' : 'short:-mb-11 short:scale-70'}`}
      >
        <Eva
          audioLevel={audioLevel}
          label={`Eva, ${presentation.stageTitle.toLowerCase()}`}
          mood={evaMoodFor(state, flow, mood)}
          size={150}
          stage={stage}
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center" role="status">
        <span
          className={`text-pip font-bold tracking-wide uppercase ${ACTOR_TONE[presentation.actor]}`}
        >
          {presentation.stageLabel}
        </span>
        <h2 className="text-title m-0 font-bold">{presentation.stageTitle}</h2>
        {!isCompact && (
          <p className="text-caption text-muted short:hidden m-0">{presentation.stageHint}</p>
        )}
      </div>
      {!isCompact && actualInput && (
        <p className="text-faint short:hidden m-0 text-xs">Microphone: {actualInput.label}</p>
      )}
    </aside>
  );
}
