import { Button, Chip } from '@heroui/react';
import { MemorySnapshot } from './MemorySnapshot';
import './dashboard.css';

type Screen = 'conversation' | 'coach' | 'memory' | 'settings';

type Props = {
  busy: boolean;
  error: string;
  hasActiveSession: boolean;
  isRestoring: boolean;
  onStartPractice: () => void;
  onOpenMemory: () => void;
  onNavigate?: (screen: Screen) => void;
};

function practiceActionLabel(isRestoring: boolean, busy: boolean, hasActiveSession: boolean) {
  if (isRestoring) return 'Restoring your conversation…';
  if (hasActiveSession) return 'Resume conversation';
  if (busy) return 'Starting practice…';
  return 'Start 10–15 Minute Practice';
}

export function DailyPracticeDashboard({
  busy,
  error,
  hasActiveSession,
  isRestoring,
  onStartPractice,
  onOpenMemory,
  onNavigate,
}: Props) {
  const actionLabel = practiceActionLabel(isRestoring, busy, hasActiveSession);
  const sessionStatus = isRestoring
    ? 'Restoring conversation'
    : hasActiveSession
      ? 'Conversation in progress'
      : busy
        ? 'Starting conversation'
        : 'Ready to start';

  return (
    <div className="dashboard-content">
      <section aria-labelledby="dashboard-title" className="dashboard-hero-card">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
              SUGGESTED DAILY PRACTICE · 10–15 MIN
            </span>
            <Chip color={hasActiveSession ? 'success' : 'default'} size="sm" variant="soft">
              {sessionStatus}
            </Chip>
          </div>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl"
              id="dashboard-title"
            >
              Ready to practice speaking?
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Start a conversation, get focused feedback, and try a stronger version of your answer.
              Speech recognition and your microphone are checked when you begin recording.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              className="dashboard-cta flex items-center gap-2"
              isDisabled={busy || isRestoring}
              onPress={onStartPractice}
              variant="primary"
            >
              <span>{actionLabel}</span>
            </Button>
            <Button onPress={() => onNavigate?.('settings')} variant="secondary">
              Check setup
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Suggested session: about 8 spoken answers, one focused re-speaking exercise, and a short
            recall review when you have saved items.
          </p>
        </div>
      </section>

      {error && (
        <div
          className="mt-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300"
          role="alert"
        >
          <span>{error}</span>
          <Button
            className="border border-rose-500/30 bg-rose-500/20 text-xs text-rose-200"
            isDisabled={busy}
            onPress={onStartPractice}
            size="sm"
            variant="secondary"
          >
            Try again
          </Button>
        </div>
      )}

      <div className="dashboard-card">
        <p className="text-xs font-bold tracking-wider text-zinc-400 uppercase">PRACTICE FLOW</p>
        <h2 className="mt-1 text-base font-semibold text-zinc-100">One useful speaking session</h2>
        <div className="dashboard-steps">
          <div className="dashboard-step-item">
            <span className="step-badge">1</span>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Warm up</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Answer a simple opening question.
              </p>
            </div>
          </div>
          <div className="dashboard-step-item">
            <span className="step-badge">2</span>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Keep talking</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Continue the conversation one answer at a time.
              </p>
            </div>
          </div>
          <div className="dashboard-step-item">
            <span className="step-badge">3</span>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Try again</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Review one focused correction and re-speak it.
              </p>
            </div>
          </div>
          <div className="dashboard-step-item">
            <span className="step-badge">4</span>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Recall</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Review saved phrases when they are due.
              </p>
            </div>
          </div>
        </div>
      </div>

      <MemorySnapshot onOpenMemory={onOpenMemory} />

      {onNavigate && (
        <div className="dashboard-card">
          <p className="text-xs font-bold tracking-wider text-zinc-400 uppercase">QUICK LINKS</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onPress={() => onNavigate('conversation')} variant="secondary">
              Open conversation
            </Button>
            <Button onPress={() => onNavigate('coach')} variant="secondary">
              Open coach
            </Button>
            <Button onPress={() => onNavigate('memory')} variant="secondary">
              Learning Memory
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
