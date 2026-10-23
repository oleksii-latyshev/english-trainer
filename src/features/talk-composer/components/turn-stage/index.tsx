import { useAtomValue } from '@effect/atom-react';
import { usePreferredMicrophone } from '@/core/audio';
import { micLevelAtom } from '@/core/practice-turn';
import { Eva } from '@/shared/ui/eva';
import { evaMoodFor, type MoodExtras } from '../../helpers/turn-state';
import { useTurn } from '../../model/use-composer';
import { flowSignalsAtom } from '../../model/view-atoms';
import { FlowControls } from '../flow-controls';

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
  const flow = useAtomValue(flowSignalsAtom);
  const audioLevel = useAtomValue(micLevelAtom);
  const { actualInput } = usePreferredMicrophone();
  if (isWriting) return <WritingStage />;
  return (
    <aside aria-label="Eva" className="flex flex-col items-center gap-3">
      <Eva
        audioLevel={audioLevel}
        label={`Eva, ${presentation.stageTitle.toLowerCase()}`}
        mood={evaMoodFor(state, flow, mood)}
        size={150}
      />
      <div className="flex flex-col items-center gap-1 text-center" role="status">
        <span
          className={`font-bold text-pip uppercase tracking-wide ${ACTOR_TONE[presentation.actor]}`}
        >
          {presentation.stageLabel}
        </span>
        <h2 className="m-0 font-bold text-title">{presentation.stageTitle}</h2>
        <p className="m-0 text-caption text-muted">{presentation.stageHint}</p>
      </div>
      <FlowControls />
      {actualInput && <p className="m-0 text-faint text-xs">Microphone: {actualInput.label}</p>}
    </aside>
  );
}
