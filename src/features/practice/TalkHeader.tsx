import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SpeechTiming } from '@/features/speech/TimingPanel';
import { TimingPopover } from '@/features/speech/TimingPanel';
import {
  elapsedSessionMs,
  formatElapsedClock,
  practiceModeLabel,
  practicePhaseLabel,
} from '@/lib/practiceOptions';
import { Button } from '@/shared/ui/button';
import { Eva, type EvaMood } from '@/shared/ui/eva';
import { Tooltip } from '@/shared/ui/tooltip';
import { mistakePracticeProgress } from './lib/mistakePracticeProgress';
import type { PauseControl } from './lib/pauseControl';
import type { SessionDetails } from './lib/practiceState';

type Props = {
  mood: EvaMood;
  session: {
    topicLabel: string;
    durationGoalSeconds: 300 | 600 | 900;
    activeDurationMs: number;
    isClockRunning: boolean;
    clockSnapshotAtMs: number;
    turnCount: number;
    targetTurns: number;
    practiceMode: SessionDetails['practiceMode'];
    practicePhase: SessionDetails['practicePhase'];
    writtenTurnCount: number;
    spokenTurnCount: number;
    isMistakePractice: boolean;
  };
  timing: SpeechTiming;
  /** Pause or Resume; when `disabledReason` is set the control is disabled and says why. */
  pause: PauseControl & { onPause: () => void; onResume: () => void };
  isFinishing: boolean;
  isFinishDisabled: boolean;
  onFinish: () => void;
  stageAction?: { label: string; onPress: () => void; isDisabled: boolean };
  isAudioStage: boolean;
};

function PauseButton({ pause }: { pause: Props['pause'] }) {
  if (pause.isPaused) {
    return (
      <Button onClick={pause.onResume} size="sm" tone="quiet">
        <Play aria-hidden="true" fill="currentColor" size={14} />
        Resume
      </Button>
    );
  }
  if (pause.disabledReason === undefined) {
    return (
      <Button onClick={pause.onPause} size="sm" tone="quiet">
        <Pause aria-hidden="true" fill="currentColor" size={14} />
        Pause
      </Button>
    );
  }
  return (
    <Tooltip className="talk-pause-trigger" content={pause.disabledReason}>
      <Button disabled size="sm" tone="quiet">
        <Pause aria-hidden="true" fill="currentColor" size={14} />
        Pause
      </Button>
    </Tooltip>
  );
}

export function TalkHeader({
  mood,
  session,
  timing,
  pause,
  isFinishing,
  isFinishDisabled,
  onFinish,
  stageAction,
  isAudioStage,
}: Props) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (!session.isClockRunning) return;
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session.isClockRunning]);
  const elapsedMs = elapsedSessionMs(
    session.activeDurationMs,
    session.clockSnapshotAtMs,
    session.isClockRunning,
    now,
  );
  const elapsedText = formatElapsedClock(elapsedMs);
  const goalText = formatElapsedClock(session.durationGoalSeconds * 1000);
  const percent = Math.min(100, (elapsedMs / (session.durationGoalSeconds * 1000)) * 100);
  const mistakeProgress = mistakePracticeProgress(session.turnCount, session.targetTurns);
  const progressValue = session.isMistakePractice
    ? mistakeProgress.value
    : Math.min(Math.floor(elapsedMs / 1000), session.durationGoalSeconds);
  const progressMax = session.isMistakePractice ? session.targetTurns : session.durationGoalSeconds;
  const progressLabel = session.isMistakePractice
    ? mistakeProgress.label
    : `${elapsedText} of ${goalText} · ${practiceModeLabel(session.practiceMode)}${
        session.practiceMode === 'write_then_speak'
          ? ` · ${practicePhaseLabel(session.practicePhase)}${
              session.practicePhase === 'speaking'
                ? ` · ${Math.min(session.spokenTurnCount, session.writtenTurnCount)} of ${session.writtenTurnCount}`
                : ''
            }`
          : ''
      }`;
  return (
    <header className="talk-header">
      <div className="talk-header-eva">
        <Eva decorative mood={mood} size={44} />
      </div>
      <div className="talk-progress">
        <div className="talk-mode">
          <div className="talk-mode-label">{session.topicLabel}</div>
          <div className="talk-mode-step">{progressLabel}</div>
        </div>
        <div
          aria-label={
            session.isMistakePractice ? 'Mistake practice questions' : 'Suggested session time'
          }
          aria-valuemax={progressMax}
          aria-valuemin={0}
          aria-valuenow={progressValue}
          className="talk-progress-track"
          role="progressbar"
        >
          <div
            className="talk-progress-fill"
            style={{
              width: `${session.isMistakePractice ? mistakeProgress.percent : percent}%`,
            }}
          />
        </div>
      </div>
      <div className="talk-header-actions">
        {!session.isMistakePractice && <TimingPopover timing={timing} />}
        {isAudioStage && <PauseButton pause={pause} />}
        {stageAction && (
          <Button
            disabled={stageAction.isDisabled}
            onClick={stageAction.onPress}
            size="sm"
            tone="secondary"
          >
            {stageAction.label}
          </Button>
        )}
        <Button disabled={isFinishDisabled} onClick={onFinish} size="sm" tone="secondary">
          {isFinishing ? 'Finishing…' : 'Finish'}
        </Button>
      </div>
    </header>
  );
}
