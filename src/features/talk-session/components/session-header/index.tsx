import { useAtomValue } from '@effect/atom-react';
import { Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SessionDetails } from '@/core/practice-session';
import { Button } from '@/shared/ui/button';
import { Tooltip } from '@/shared/ui/tooltip';
import { elapsedSessionMs, sessionProgress } from '../../helpers/session-progress';
import { stageActionFor } from '../../helpers/stage-action';
import {
  isActionBlockedAtom,
  keepsMicrophoneAtom,
  pauseAtom,
  secondTickAtom,
  timingAtom,
} from '../../model/header-atoms';
import { useSessionCommands } from '../../model/use-session';
import { TimingPopover } from '../timing-popover';

type Props = {
  session: SessionDetails;
  isFinishing: boolean;
  isFinishBlocked: boolean;
  leading?: ReactNode;
  children?: ReactNode;
};

function PauseButton() {
  const pause = useAtomValue(pauseAtom);
  const commands = useSessionCommands();
  if (pause.isPaused) {
    return (
      <Button onClick={commands.resumeMicrophone} size="sm" tone="quiet">
        <Play aria-hidden="true" fill="currentColor" />
        Resume
      </Button>
    );
  }
  if (pause.disabledReason === undefined) {
    return (
      <Button onClick={commands.pauseMicrophone} size="sm" tone="quiet">
        <Pause aria-hidden="true" fill="currentColor" />
        Pause
      </Button>
    );
  }
  return (
    <Tooltip content={pause.disabledReason}>
      <Button disabled size="sm" tone="quiet">
        <Pause aria-hidden="true" fill="currentColor" />
        Pause
      </Button>
    </Tooltip>
  );
}

export function SessionHeader({ session, isFinishing, isFinishBlocked, leading, children }: Props) {
  const tick = useAtomValue(secondTickAtom);
  const now = tick._tag === 'Success' ? tick.value : performance.now();
  const commands = useSessionCommands();
  const timing = useAtomValue(timingAtom);
  const keepsMicrophone = useAtomValue(keepsMicrophoneAtom);
  const isBlocked = useAtomValue(isActionBlockedAtom);
  const elapsedMs = elapsedSessionMs(
    session.activeDurationMs,
    session.clockSnapshotAtMs,
    session.isClockRunning,
    now,
  );
  const progress = sessionProgress(session, elapsedMs);
  const stageAction = stageActionFor({
    mode: session.practiceMode,
    phase: session.practicePhase,
    writtenCount: session.writtenTurnCount,
    spokenCount: session.spokenTurnCount,
  });

  return (
    <header className="mx-auto flex w-full max-w-205 items-center gap-4 px-6 pt-3">
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-3">
          <span className="text-body truncate font-bold">{session.topicLabel}</span>
          <span className="text-caption text-muted truncate">{progress.label}</span>
        </div>
        {progress.bar && (
          <div
            aria-label={
              session.isMistakePractice ? 'Mistake practice questions' : 'Suggested session time'
            }
            aria-valuemax={progress.bar.max}
            aria-valuemin={0}
            aria-valuenow={progress.bar.value}
            className="bg-surface-2 h-1.5 overflow-hidden rounded-full"
            role="progressbar"
          >
            <div
              className="bg-accent h-full rounded-full"
              style={{ width: `${progress.bar.percent}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!session.isMistakePractice && <TimingPopover timing={timing} />}
        {keepsMicrophone && <PauseButton />}
        {children}
        {stageAction && (
          <Button
            disabled={isBlocked}
            onClick={() => commands.transition(stageAction.target)}
            size="sm"
            tone="secondary"
          >
            {stageAction.label}
          </Button>
        )}
        <Button
          disabled={isBlocked || isFinishBlocked}
          onClick={commands.finish}
          size="sm"
          tone="secondary"
        >
          {isFinishing ? 'Finishing…' : 'Finish'}
        </Button>
      </div>
    </header>
  );
}
