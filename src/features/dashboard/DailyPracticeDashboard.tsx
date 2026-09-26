import { Button, Card, Chip } from '@heroui/react';
import { Briefcase, Flame, MessageSquare, Rabbit, Target, Zap } from 'lucide-react';
import { MemorySnapshot } from './MemorySnapshot';
import './dashboard.css';

type Screen =
  | 'home'
  | 'conversation'
  | 'coach'
  | 'interview'
  | 'drills'
  | 'memory'
  | 'progress'
  | 'settings'
  | 'summary';

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
  const isLoading = busy || isRestoring;

  return (
    <div className="dashboard-content">
      {/* 1. Hero Card */}
      <section aria-labelledby="dashboard-title">
        <Card className="panel dashboard-hero-card border border-white/[0.08] bg-[#161619] shadow-xl">
          <Card.Header className="dashboard-hero-header">
            <div>
              <p className="eyebrow text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                DAILY PRACTICE · GUIDED ROUTINE
              </p>
              <h1
                className="mt-1 text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl"
                id="dashboard-title"
              >
                Make today a speaking day.
              </h1>
            </div>
            <Chip
              className="dashboard-status"
              color={hasActiveSession ? 'success' : 'default'}
              size="sm"
              variant="soft"
            >
              {sessionStatus}
            </Chip>
          </Card.Header>

          <Card.Content className="dashboard-hero-content">
            <div className="dashboard-hero-grid">
              <div>
                <p className="intro text-sm leading-relaxed text-zinc-400">
                  Start with a spoken question, build your answer aloud, and get a chance to try
                  again with focused feedback.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="dashboard-cta rounded-xl bg-white px-7 py-3 text-sm font-semibold text-black shadow-lg shadow-white/[0.04] transition-all hover:bg-zinc-200 active:scale-[0.98]"
                    isDisabled={busy || isRestoring}
                    onPress={onStartPractice}
                    variant="primary"
                  >
                    <span aria-hidden="true" className="mr-1.5 text-xs">
                      ▶
                    </span>{' '}
                    {actionLabel}
                  </Button>
                </div>
                <p className="dashboard-caption mt-3 text-xs text-zinc-500">
                  Recommended routine · 8 spoken answers · 4 steps · ~12 minutes total. All data is
                  stored locally.
                </p>
              </div>

              {/* Animated Mini Eva Companion Figure */}
              <figure className={`nori-figure${isLoading ? ' is-running' : ''}`}>
                <div className="nori-stage" aria-hidden="true">
                  <span className="nori-speed-lines" />
                  <Rabbit className="nori-rabbit text-purple-200" strokeWidth={1.6} />
                </div>
                <figcaption className="mt-2 text-xs text-zinc-400">
                  {isLoading ? 'Mini Eva is preparing…' : 'Mini Eva: Lv. 3 Companion'}
                </figcaption>
              </figure>
            </div>
          </Card.Content>
        </Card>

        {error && (
          <div
            className="mt-3 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300"
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
      </section>

      {/* 2. Today's Guided Session Blueprint */}
      <Card className="panel dashboard-card border border-white/[0.08] bg-[#161619] shadow-lg">
        <Card.Header className="dashboard-card-header flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <p className="section-kicker text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              YOUR SESSION BLUEPRINT
            </p>
            <Card.Title className="section-title text-base font-semibold text-zinc-100">
              4 Steps to Spoken Confidence
            </Card.Title>
          </div>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
            8-answer goal · 10–15 min suggested
          </span>
        </Card.Header>
        <Card.Content className="dashboard-steps pt-2">
          <div className="dashboard-step">
            <span className="step-number bg-white/[0.06] text-zinc-200">1</span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Hear a spoken question</h2>
              <p className="text-xs text-zinc-400">
                The conversation opens with an authentic prompt you answer aloud in your own words.
              </p>
            </div>
          </div>
          <div className="dashboard-step">
            <span className="step-number bg-white/[0.06] text-zinc-200">2</span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Speak and review transcripts</h2>
              <p className="text-xs text-zinc-400">
                Transcribed locally via Metal-accelerated Whisper; speech is read back naturally.
              </p>
            </div>
          </div>
          <div className="dashboard-step">
            <span className="step-number bg-white/[0.06] text-zinc-200">3</span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Strengthen with focused feedback
              </h2>
              <p className="text-xs text-zinc-400">
                Receive 1–3 focused corrections, B1→B2 natural phrase rewrites, and immediate Try
                Again.
              </p>
            </div>
          </div>
          <div className="dashboard-step">
            <span className="step-number bg-white/[0.06] text-zinc-200">4</span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Spaced recall & wrap up</h2>
              <p className="text-xs text-zinc-400">
                Vocalize up to three phrases due for review, then review your session metrics and
                XP.
              </p>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* 3. 3-Card Momentum & Memory Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Widget 1: Mini Eva Daily Quest */}
        <Card className="border border-white/[0.08] bg-[#161619] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-purple-400">🌱 MINI EVA QUEST</span>
            <span className="rounded-full bg-purple-950 px-2 py-0.5 text-[10px] text-purple-300">
              +30 XP
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-zinc-200">
            "Explain a recent technical trade-off or challenge in 3 sentences."
          </p>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Level 3 · Progress</span>
            <span>240 / 300 XP</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-purple-500" style={{ width: '80%' }} />
          </div>
        </Card>

        {/* Widget 2: Spaced Repetition Snapshot */}
        <MemorySnapshot onOpenMemory={onOpenMemory} />

        {/* Widget 3: Weekly Speaking Volume */}
        <Card className="border border-white/[0.08] bg-[#161619] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-400">⏱️ WEEKLY SPEAKING</span>
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <Flame className="h-3 w-3" /> 3-Day Streak
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-zinc-100">28 min</span>
            <span className="text-xs text-zinc-500">/ 45 min target</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Weekly Momentum</span>
            <span>62%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-emerald-500" style={{ width: '62%' }} />
          </div>
        </Card>
      </div>

      {/* 4. Quick Specialized Modes Access */}
      {onNavigate && (
        <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3">
            <div>
              <p className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                SPECIALIZED TRAINING MODES
              </p>
              <h3 className="text-sm font-semibold text-zinc-100">
                Target Specific Fluency Dimensions
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/20 p-3.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('conversation')}
              type="button"
            >
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              <span className="mt-2 text-xs font-semibold text-zinc-200">Conversation Mode</span>
              <p className="mt-1 text-[11px] text-zinc-500">
                Spontaneous back-and-forth dialogue with low latency.
              </p>
            </button>

            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/20 p-3.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('coach')}
              type="button"
            >
              <Target className="h-5 w-5 text-purple-400" />
              <span className="mt-2 text-xs font-semibold text-zinc-200">Coach & Re-Speak</span>
              <p className="mt-1 text-[11px] text-zinc-500">
                Deliberate feedback, B2 upgrades, and Try Again side-by-side.
              </p>
            </button>

            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/20 p-3.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('interview')}
              type="button"
            >
              <Briefcase className="h-5 w-5 text-rose-400" />
              <span className="mt-2 text-xs font-semibold text-zinc-200">The Hot Seat</span>
              <p className="mt-1 text-[11px] text-zinc-500">
                High-stakes technical and behavioral interview pressure.
              </p>
            </button>

            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/20 p-3.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('drills')}
              type="button"
            >
              <Zap className="h-5 w-5 text-amber-400" />
              <span className="mt-2 text-xs font-semibold text-zinc-200">Skill Drills</span>
              <p className="mt-1 text-[11px] text-zinc-500">
                30s elevator pitches, STAR vocalizers, and paraphrasing.
              </p>
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
