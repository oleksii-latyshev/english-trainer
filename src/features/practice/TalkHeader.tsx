import { Button, Chip } from '@heroui/react';
import { Pause, Play } from 'lucide-react';
import { Eva, type EvaMood } from '@/components/eva/Eva';
import type { SpeechTiming } from '@/features/speech/TimingPanel';
import { TimingPopover } from '@/features/speech/TimingPanel';

type Props = {
  mode: 'conversation' | 'coach';
  /** Where Coach is in its flow, e.g. "Feedback". */
  coachStep?: string;
  mood: EvaMood;
  turnCount: number;
  targetTurns: number;
  timing: SpeechTiming;
  /** Pause is offered only while a warm microphone session exists. */
  pause?: { isPaused: boolean; isDisabled: boolean; onPause: () => void; onResume: () => void };
  isFinishing: boolean;
  isFinishDisabled: boolean;
  onFinish: () => void;
};

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
        {pause &&
          (pause.isPaused ? (
            <Button onPress={pause.onResume} size="sm" variant="ghost">
              <Play aria-hidden="true" fill="currentColor" size={14} />
              Resume
            </Button>
          ) : (
            <Button isDisabled={pause.isDisabled} onPress={pause.onPause} size="sm" variant="ghost">
              <Pause aria-hidden="true" fill="currentColor" size={14} />
              Pause
            </Button>
          ))}
        <Button isDisabled={isFinishDisabled} onPress={onFinish} size="sm" variant="secondary">
          {isFinishing ? 'Finishing…' : 'Finish'}
        </Button>
      </div>
    </header>
  );
}
