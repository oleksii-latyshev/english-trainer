import { Button, Kbd } from '@heroui/react';
import { isTauri } from '@tauri-apps/api/core';
import { Fragment } from 'react';
import { GuidedAnswerPanel } from './GuidedAnswerPanel';
import { HELP_LEVELS, type HelpLevel } from './lib/helpLevels';
import { PlanningTimer } from './PlanningTimer';
import { useAnswerPlan } from './useAnswerPlan';
import { usePlanningTimer } from './usePlanningTimer';

type Props = {
  question: string;
  sessionId?: number;
  sequence?: number;
  level: HelpLevel | null;
  onLevelChange: (level: HelpLevel | null) => void;
  disabled: boolean;
  isRecording: boolean;
  onPlanningChange?: (active: boolean) => void;
  notice?: string;
};

export function HelpBar({
  question,
  sessionId,
  sequence,
  level,
  onLevelChange,
  disabled,
  isRecording,
  onPlanningChange,
  notice,
}: Props) {
  const answer = useAnswerPlan(sessionId, sequence, question);
  const timer = usePlanningTimer({
    isOpen: level === 'frame',
    isRecording,
    isDisabled: disabled,
    onPlanningChange,
  });
  const plan = answer.plan;
  return (
    <section aria-label="Answer help" className="talk-help">
      {notice && (
        <p className="talk-help-text" role="status">
          {notice}
        </p>
      )}
      <div className="talk-help-row">
        <span className="talk-help-label">Need help?</span>
        {HELP_LEVELS.map((item) => (
          <Button
            aria-pressed={level === item.id}
            className="talk-chip"
            isDisabled={disabled}
            key={item.id}
            onPress={() => {
              if (level === item.id) {
                if (item.id === 'example') timer.cancel();
                onLevelChange(null);
                return;
              }
              onLevelChange(item.id);
            }}
            size="sm"
            variant="outline"
          >
            <span aria-hidden="true" className="talk-chip-number">
              {item.keyNumber}
            </span>
            {item.label}
          </Button>
        ))}
        <span className="talk-help-key">
          <Kbd>H</Kbd>
          help
        </span>
      </div>
      {level === 'frame' && (
        <div className="talk-help-panel">
          {!isTauri() && (
            <p className="talk-help-text">Answer help is available in the desktop app.</p>
          )}
          {isTauri() && plan && (
            <div className="talk-help-group">
              <div className="talk-help-caption">A simple flow for this question</div>
              <div className="talk-help-chips">
                {plan.frame.map((step, index) => (
                  <Fragment key={step}>
                    <span className="talk-chip-static">{step}</span>
                    {index < plan.frame.length - 1 && (
                      <span aria-hidden="true" className="talk-help-arrow">
                        →
                      </span>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
          {!plan && isTauri() && (
            <GuidedAnswerPanel
              hasError={answer.hasError}
              errorMessage={answer.errorMessage}
              isLoading={answer.isLoading}
              isRecording={isRecording}
              onRetry={() => void answer.retry()}
              onHide={() => onLevelChange(null)}
              plan={null}
            />
          )}
          <PlanningTimer
            isActive={timer.durationSeconds !== null}
            isDisabled={disabled || isRecording}
            onCancel={timer.cancel}
            onStart={timer.start}
            remainingSeconds={timer.remainingSeconds}
          />
        </div>
      )}
      {level === 'phrases' && (
        <div className="talk-help-panel">
          {!isTauri() ? (
            <p className="talk-help-text">Answer help is available in the desktop app.</p>
          ) : plan ? (
            <div className="talk-help-chips">
              {plan.phrases.map((phrase) => (
                <span className="talk-chip-static" key={phrase}>
                  {phrase}
                </span>
              ))}
            </div>
          ) : (
            <GuidedAnswerPanel
              hasError={answer.hasError}
              errorMessage={answer.errorMessage}
              isLoading={answer.isLoading}
              isRecording={isRecording}
              onRetry={() => void answer.retry()}
              onHide={() => onLevelChange(null)}
              plan={null}
            />
          )}
        </div>
      )}
      {level === 'example' && (
        <div className="talk-help-panel">
          <GuidedAnswerPanel
            hasError={answer.hasError}
            errorMessage={answer.errorMessage}
            isLoading={answer.isLoading}
            isRecording={isRecording}
            onRetry={() => void answer.retry()}
            onHide={() => onLevelChange(null)}
            plan={plan}
          />
        </div>
      )}
    </section>
  );
}
