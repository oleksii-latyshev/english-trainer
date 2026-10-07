import { Button, Chip, Tooltip } from '@heroui/react';
import { Pause, Play } from 'lucide-react';
import { Eva, type EvaMood } from '@/components/eva/Eva';
import type { SpeechTiming } from '@/features/speech/TimingPanel';
import { TimingPopover } from '@/features/speech/TimingPanel';
import type { PauseControl } from './lib/pauseControl';

type Props = {
  mode: 'conversation' | 'coach';
  /** Where Coach is in its flow, e.g. "Feedback". */
  coachStep?: string;
  mood: EvaMood;
  turnCount: number;
  targetTurns: number;
  timing: SpeechTiming;
  /** Pause or Resume; when `disabledReason` is set the control is disabled and says why. */
  pause: PauseControl & { onPause: () => void; onResume: () => void };
  isFinishing: boolean;
  isFinishDisabled: boolean;
  onFinish: () => void;
};

function PauseButton({ pause }: { pause: Props['pause'] }) {
  if (pause.isPaused) {
    return (
      <Button onPress={pause.onResume} size="sm" variant="ghost">
        <Play aria-hidden="true" fill="currentColor" size={14} />
        Resume
      </Button>
    );
  }
  if (pause.disabledReason === undefined) {
    return (
      <Button onPress={pause.onPause} size="sm" variant="ghost">
        <Pause aria-hidden="true" fill="currentColor" size={14} />
        Pause
      </Button>
    );
  }
  return (
    <Tooltip>
      <Tooltip.Trigger className="talk-pause-trigger">
        <Button isDisabled size="sm" variant="ghost">
          <Pause aria-hidden="true" fill="currentColor" size={14} />
          Pause
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{pause.disabledReason}</Tooltip.Content>
    </Tooltip>
  );
}

export function TalkHeader({
  mode,
  coachStep,
  mood,
  turnCount,
  targetTurns,
  timing,
  pause,
  isFinishing,
  isFinishDisabled,
  onFinish,
}: Props) {
  const percent = Math.min(100, (turnCount / Math.max(1, targetTurns)) * 100);
  return (
    <header className="talk-header">
      <div className="talk-header-eva">
        <Eva decorative mood={mood} size={44} />
      </div>
      {mode === 'coach' && (
        <div className="talk-mode">
          <Chip color="accent" size="sm" variant="soft">
            Coach
          </Chip>
          {coachStep && <span className="talk-mode-step">{coachStep}</span>}
        </div>
      )}
      <div className="talk-progress">
        <div
          aria-label="Answers so far"
          aria-valuemax={targetTurns}
          aria-valuemin={0}
          aria-valuenow={Math.min(turnCount, targetTurns)}
          className="talk-progress-track"
          role="progressbar"
        >
          <div className="talk-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="talk-progress-count">
          {turnCount} <span>of {targetTurns} answers</span>
        </div>
      </div>
      <div className="talk-header-actions">
        <TimingPopover timing={timing} />
        <PauseButton pause={pause} />
        <Button isDisabled={isFinishDisabled} onPress={onFinish} size="sm" variant="secondary">
          {isFinishing ? 'Finishing…' : 'Finish'}
        </Button>
      </div>
    </header>
  );
}
