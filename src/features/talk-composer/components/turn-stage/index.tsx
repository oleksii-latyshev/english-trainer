import { useAtomValue } from '@effect/atom-react';
import { usePreferredMicrophone } from '@/core/audio';
import { evaStageAtom } from '@/core/eva-growth';
import { micLevelAtom } from '@/core/practice-turn';
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
      <h2 className="m-0 font-bold text-title">Write your answer</h2>
      <p className="m-0 text-caption text-muted">
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
  if (isWriting) return <WritingStage />;
  return (
    <aside
      aria-label="Eva"
      className="pointer-events-none relative z-10 flex flex-col items-center gap-3"
    >
      <div
        className={`origin-top transition-[transform,margin] duration-200 motion-reduce:transition-none ${isCompact ? '-mb-16 scale-60' : ''}`}
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
          className={`font-bold text-pip uppercase tracking-wide ${ACTOR_TONE[presentation.actor]}`}
        >
          {presentation.stageLabel}
        </span>
        <h2 className="m-0 font-bold text-title">{presentation.stageTitle}</h2>
        {!isCompact && <p className="m-0 text-caption text-muted">{presentation.stageHint}</p>}
      </div>
      {!isCompact && actualInput && (
        <p className="m-0 text-faint text-xs">Microphone: {actualInput.label}</p>
      )}
    </aside>
  );
}
