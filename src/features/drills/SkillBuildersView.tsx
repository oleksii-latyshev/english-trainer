import { Button, Card, Chip } from '@heroui/react';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

type DrillType = 'paraphrase' | 'pitch' | 'simplifier' | 'star';

type DrillPrompt = {
  id: string;
  type: DrillType;
  title: string;
  sourceText: string;
  instruction: string;
  targetCollocations: string[];
  durationSeconds: number;
  sampleUpgrade: string;
};

const DRILLS: Record<DrillType, DrillPrompt> = {
  paraphrase: {
    id: 'drill-para-1',
    type: 'paraphrase',
    title: 'Paraphrase Challenge: Upgrading B1 Connectors',
    sourceText: 'Our app was very slow, so we used caching to make it quick.',
    instruction:
      'Rephrase this using a purpose clause ("To address...") and natural technical collocations without using "very slow" or "make it quick".',
    targetCollocations: [
      'latency bottleneck',
      'significant performance boost',
      'introduce caching',
    ],
    durationSeconds: 30,
    sampleUpgrade:
      'To address our latency bottleneck, we introduced Redis caching, which delivered a significant performance boost.',
  },
  pitch: {
    id: 'drill-pitch-1',
    type: 'pitch',
    title: '30-Second Elevator Pitch: Technical Ownership',
    sourceText: 'Introduce who you are and the core engineering system you own in 30 seconds.',
    instruction:
      'State your specialty, current team focus, and one measurable scale challenge you solve.',
    targetCollocations: ['specialize in', 'high-throughput', 'end-to-end ownership'],
    durationSeconds: 30,
    sampleUpgrade:
      'I specialize in high-throughput backend systems. Currently, I lead our payment gateway infrastructure, ensuring sub-50ms p99 latency across millions of daily transactions while maintaining end-to-end ownership.',
  },
  simplifier: {
    id: 'drill-simple-1',
    type: 'simplifier',
    title: "Explain Like I'm 10: Technical Jargon Stripper",
    sourceText:
      'Explain how a "Database Index" works to a non-technical stakeholder or 10-year-old child without using words like B-Tree, binary, algorithm, or memory block.',
    instruction:
      'Use an everyday analogy (e.g. a book index, a library catalogue, a grocery store).',
    targetCollocations: [
      'like an index in a book',
      'flip directly to',
      'instead of reading every page',
    ],
    durationSeconds: 45,
    sampleUpgrade:
      'Think of a database index like the index at the back of a cookbook. Instead of reading all 500 pages to find a pancake recipe, you flip directly to the letter P and jump straight to page 42.',
  },
  star: {
    id: 'drill-star-1',
    type: 'star',
    title: 'STAR Story Vocalizer: Strong Action Signposts',
    sourceText:
      'You are describing resolving a production outage. Vocalize ONLY the ACTION phase in 3 concise sentences.',
    instruction:
      'Use authoritative active verbs (e.g. "I prioritized", "I isolated", "I deployed").',
    targetCollocations: [
      'isolated the root cause',
      'orchestrated the mitigation',
      'rolled out a hotfix',
    ],
    durationSeconds: 45,
    sampleUpgrade:
      'First, I isolated the root cause to an unindexed database query via telemetry logs. Next, I orchestrated the mitigation by redirecting non-critical traffic. Finally, I rolled out a hotfix within 20 minutes.',
  },
};

export function SkillBuildersView() {
  const [activeDrillType, setActiveDrillType] = useState<DrillType>('paraphrase');
  const [isRecording, setIsRecording] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(14);
  const [showResult, setShowResult] = useState(true);
  const [userSpokenText, setUserSpokenText] = useState(
    'To address our latency bottleneck, we introduced caching, which delivered a significant performance boost.',
  );

  const drill = DRILLS[activeDrillType];
  const remainingSeconds = Math.max(0, drill.durationSeconds - secondsElapsed);
  const progressPercent = Math.min(100, Math.round((secondsElapsed / drill.durationSeconds) * 100));

  function toggleRecord() {
    setIsRecording((prev) => !prev);
    if (!isRecording) {
      setShowResult(false);
      setSecondsElapsed(0);
      setUserSpokenText('');
    } else {
      setShowResult(true);
      setUserSpokenText(drill.sampleUpgrade);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
      {/* Header Context */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            SKILL BUILDERS & DRILLS
          </span>
          <Chip color="warning" size="sm" variant="soft">
            Micro-Workouts
          </Chip>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Targeted Speaking Gym
        </h1>
        <p className="text-sm text-zinc-400">
          Isolate specific bottlenecks: rapid paraphrasing, 30s elevator pitching, simplifying
          jargon, and STAR vocalization. Short 30–60s bursts.
        </p>
      </div>

      {/* Drill Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeDrillType === 'paraphrase'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => {
            setActiveDrillType('paraphrase');
            setShowResult(true);
          }}
          type="button"
        >
          <span>🔄</span> Paraphrase Challenge
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeDrillType === 'pitch'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => {
            setActiveDrillType('pitch');
            setShowResult(true);
          }}
          type="button"
        >
          <span>⚡</span> 30s Pitch
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeDrillType === 'simplifier'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => {
            setActiveDrillType('simplifier');
            setShowResult(true);
          }}
          type="button"
        >
          <span>👶</span> Simplifier (ELI10)
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeDrillType === 'star'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => {
            setActiveDrillType('star');
            setShowResult(true);
          }}
          type="button"
        >
          <span>🌟</span> STAR Vocalizer
        </button>
      </div>

      {/* Drill Prompt Card */}
      <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3">
          <span className="text-xs font-semibold tracking-wider text-purple-400 uppercase">
            {drill.title}
          </span>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
            Target: {drill.durationSeconds}s
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
          <p className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            ORIGINAL PHRASING
          </p>
          <p className="mt-1 text-base font-semibold text-zinc-200">"{drill.sourceText}"</p>
          <p className="mt-2 text-xs text-zinc-400">{drill.instruction}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Target Collocations:</span>
          {drill.targetCollocations.map((collocation) => (
            <Chip
              className="border-white/10 bg-white/[0.04] text-xs text-zinc-300"
              key={collocation}
              size="sm"
              variant="soft"
            >
              {collocation}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Recording Canvas */}
      <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Time Remaining: {remainingSeconds}s / {drill.durationSeconds}s
            </span>
          </div>
          <span className="text-xs text-zinc-400">{progressPercent}%</span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <Button
            className={`min-h-[46px] rounded-xl px-6 text-sm font-semibold transition-all ${
              isRecording
                ? 'border border-rose-500/50 bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                : 'bg-white text-black shadow-md hover:bg-zinc-200 active:scale-[0.98]'
            }`}
            onPress={toggleRecord}
            variant="primary"
          >
            {isRecording ? (
              <>
                <MicOff className="h-4 w-4" /> Stop & Check Drill
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Speak Drill (Hold Space)
              </>
            )}
          </Button>

          <Button
            className="border border-white/10 bg-white/[0.04] text-xs text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
            onPress={() => {
              setSecondsElapsed(0);
              setUserSpokenText('');
              setShowResult(false);
            }}
            size="sm"
            variant="secondary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Drill</span>
          </Button>
        </div>
      </Card>

      {/* Instant Result & Evaluation */}
      {showResult && (
        <Card className="border border-emerald-500/30 bg-emerald-950/10 p-5 shadow-lg">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-emerald-300">
                Drill Passed · Outstanding B2 Upgrade (+20 XP)
              </h4>
            </div>
            <Chip color="success" size="sm" variant="soft">
              Collocations Matched
            </Chip>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/40 p-4">
            <p className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              YOUR ANSWER
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-100">"{userSpokenText}"</p>
          </div>

          <div className="mt-3 flex flex-col gap-1.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                Collocations used: <strong>"latency bottleneck"</strong>,{' '}
                <strong>"significant performance boost"</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                Sentence structure: Purpose clause cleanly eliminates repetitive "so we..."
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 pt-2">
            <Button
              className="border border-white/10 bg-white/[0.06] text-xs text-zinc-200 hover:bg-white/10"
              size="sm"
              variant="secondary"
            >
              <Bookmark className="h-3.5 w-3.5 text-amber-400" />
              <span>Save Collocation to Memory</span>
            </Button>
            <Button
              className="bg-white text-xs font-medium text-black hover:bg-zinc-200"
              size="sm"
              variant="primary"
            >
              <span>Next Challenge</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
