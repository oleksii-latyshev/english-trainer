import { Fragment } from 'react';
import { isTauriRuntime } from '@/core/ipc';
import { Chip } from '@/shared/ui/chip';
import { DESKTOP_ONLY } from '../../helpers/help-copy';
import type { HelpLevel } from '../../helpers/help-levels';
import type { PlanningSeconds, PlanState } from '../../types';
import { ModelAnswer } from '../model-answer';
import { PlanStatus } from '../plan-status';
import { PlanningTimer } from '../planning-timer';

type Props = {
  level: HelpLevel;
  plan: PlanState;
  isDisabled: boolean;
  isRecording: boolean;
  isPlanning: boolean;
  remainingSeconds: number;
  onRetry: () => void;
  onHide: () => void;
  onStartPlanning: (seconds: PlanningSeconds) => void;
  onCancelPlanning: () => void;
};

const PANEL = 'flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4.5 py-4';
const CAPTION = 'text-faint text-xs';

function FrameSteps({ steps }: { steps: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={CAPTION}>A simple flow for this question</div>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <Fragment key={step}>
            <Chip size="md">{step}</Chip>
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="text-faint">
                →
              </span>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PhraseChips({ phrases }: { phrases: readonly string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {phrases.map((phrase) => (
        <Chip key={phrase} size="md">
          {phrase}
        </Chip>
      ))}
    </div>
  );
}

function LevelContent(props: Props) {
  const { plan, level } = props;
  if (!isTauriRuntime()) {
    return <p className="text-caption text-muted m-0 leading-normal">{DESKTOP_ONLY}</p>;
  }
  if (plan.tag !== 'ready') return <PlanStatus onRetry={props.onRetry} plan={plan} />;
  if (level === 'frame') return <FrameSteps steps={plan.plan.frame} />;
  if (level === 'phrases') return <PhraseChips phrases={plan.plan.phrases} />;
  return (
    <ModelAnswer
      isRecording={props.isRecording}
      onHide={props.onHide}
      text={plan.plan.model_answer}
    />
  );
}

export function PlanPanel(props: Props) {
  return (
    <div className={PANEL}>
      <LevelContent {...props} />
      {props.level === 'frame' && (
        <PlanningTimer
          isActive={props.isPlanning}
          isDisabled={props.isDisabled || props.isRecording}
          onCancel={props.onCancelPlanning}
          onStart={props.onStartPlanning}
          remainingSeconds={props.remainingSeconds}
        />
      )}
    </div>
  );
}
