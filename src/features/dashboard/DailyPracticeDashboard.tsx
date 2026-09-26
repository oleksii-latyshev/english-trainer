import { Button, Chip } from '@heroui/react';
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
      {/* 1. Golden Path Hero: Start Today's Practice */}
      <section aria-labelledby="dashboard-title">
        <div className="dashboard-hero-card">
          <div className="dashboard-hero-grid">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                  RECOMMENDED DAILY WORKOUT · ~12 MIN
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
                  Ready for today's spoken session?
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                  No configuration needed. Click the button below to start: Eva will ask an
                  authentic question, you hold Space to speak aloud, and we'll refine your answers
                  with B2 phrasing.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  className="dashboard-cta flex items-center gap-2"
                  isDisabled={busy || isRestoring}
                  onPress={onStartPractice}
                  variant="primary"
                >
                  <span aria-hidden="true" className="text-xs">
                    ▶
                  </span>
                  <span>{actionLabel}</span>
                </Button>
              </div>

              <p className="text-xs text-zinc-500">
                8 spoken turns · 1 B2 upgrade & re-speaking · 3 due flashcards recall. Data saved
                locally.
              </p>
            </div>

            {/* Animated Mini Eva Companion Figure */}
            <figure className={`nori-figure${isLoading ? ' is-running' : ''}`}>
              <div className="nori-stage" aria-hidden="true">
                <span className="nori-speed-lines" />
                <Rabbit className="nori-rabbit" strokeWidth={1.6} />
              </div>
              <figcaption className="mt-3 text-center text-xs font-medium text-zinc-400">
                {isLoading ? 'Mini Eva is preparing…' : 'Mini Eva · Lv.3 Companion'}
              </figcaption>
            </figure>
          </div>
        </div>

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
      </section>

      {/* 2. Visual Blueprint: Exactly What Happens in a Session */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between pb-1">
          <div>
            <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              THE 4-STEP LEARNING LOOP
            </span>
            <h2 className="mt-1 text-base font-semibold text-zinc-100">
              How today's 12-minute workout unfolds
            </h2>
          </div>
          <span className="hidden rounded-full bg-zinc-800/80 px-3 py-1 text-xs text-zinc-400 sm:inline-block">
            Target: 8 spoken turns
          </span>
        </div>

        <div className="dashboard-steps">
          <div className="dashboard-step-item">
            <div className="flex items-center justify-between">
              <span className="step-badge">1</span>
              <span className="text-[11px] text-zinc-500">1–2 min</span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Hear a Question</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Eva opens with a clear question. Listen to the audio or read the transcript.
              </p>
            </div>
          </div>

          <div className="dashboard-step-item">
            <div className="flex items-center justify-between">
              <span className="step-badge">2</span>
              <span className="text-[11px] text-zinc-500">5–7 min</span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Speak Aloud</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Hold Space to speak. Audio is transcribed locally with Apple Silicon Metal Whisper.
              </p>
            </div>
          </div>

          <div className="dashboard-step-item">
            <div className="flex items-center justify-between">
              <span className="step-badge">3</span>
              <span className="text-[11px] text-zinc-500">2–3 min</span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Deliberate Upgrade</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Inspect 1 focused correction & B2 phrase rewrites, then re-speak your answer.
              </p>
            </div>
          </div>

          <div className="dashboard-step-item">
            <div className="flex items-center justify-between">
              <span className="step-badge">4</span>
              <span className="text-[11px] text-zinc-500">1–2 min</span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Spaced Recall</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Vocalize 3 due phrases from earlier sessions without seeing the text.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 3-Card Momentum & Flashcard Queue */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Widget 1: Mini Eva Daily Quest */}
        <div className="dashboard-card flex flex-col justify-between gap-4 p-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-purple-400 uppercase">🌱 MINI EVA QUEST</span>
            <span className="rounded-full bg-purple-950/80 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              +30 XP
            </span>
          </div>
          <div>
            <p className="text-xs leading-relaxed font-medium text-zinc-200">
              "Explain a recent technical trade-off or challenge in 3 sentences."
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Level 3 Progress</span>
              <span>240 / 300 XP</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-purple-500" style={{ width: '80%' }} />
            </div>
          </div>
        </div>

        {/* Widget 2: Spaced Repetition Memory Queue */}
        <MemorySnapshot onOpenMemory={onOpenMemory} />

        {/* Widget 3: Weekly Speaking Volume */}
        <div className="dashboard-card flex flex-col justify-between gap-4 p-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-400 uppercase">⏱️ WEEKLY SPEAKING</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
              <Flame className="h-3.5 w-3.5" /> 3-Day Streak
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-100">28 min</span>
              <span className="text-xs text-zinc-500">/ 45 min target</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Weekly Momentum</span>
              <span>62%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-emerald-500" style={{ width: '62%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Specialized Training Gyms (When user wants specific practice) */}
      {onNavigate && (
        <div className="dashboard-card">
          <div className="pb-2">
            <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              TARGETED TRAINING GYMS
            </span>
            <h2 className="mt-1 text-base font-semibold text-zinc-100">
              Want to practice something specific today?
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Pick a specialized mode to train interviews, rapid pitch timing, or review saved
              flashcards.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/25 p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('interview')}
              type="button"
            >
              <Briefcase className="h-5 w-5 text-rose-400" />
              <span className="mt-2.5 text-xs font-semibold text-zinc-200">The Hot Seat</span>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                High-pressure technical and behavioral STAR interview scenarios.
              </p>
            </button>

            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/25 p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('drills')}
              type="button"
            >
              <Zap className="h-5 w-5 text-amber-400" />
              <span className="mt-2.5 text-xs font-semibold text-zinc-200">Skill Drills</span>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                30s elevator pitch, rapid paraphrasing, and jargon simplification.
              </p>
            </button>

            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/25 p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('conversation')}
              type="button"
            >
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              <span className="mt-2.5 text-xs font-semibold text-zinc-200">Conversation Mode</span>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Continuous spoken dialogue with Eva without coaching pauses.
              </p>
            </button>

            <button
              className="flex flex-col items-start rounded-xl border border-white/[0.06] bg-black/25 p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.04]"
              onClick={() => onNavigate('memory')}
              type="button"
            >
              <Target className="h-5 w-5 text-purple-400" />
              <span className="mt-2.5 text-xs font-semibold text-zinc-200">Phrase Flashcards</span>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Review your saved B2 collocations and eliminated Slavicisms.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
