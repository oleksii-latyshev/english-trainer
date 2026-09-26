import { Button, Card, Chip } from '@heroui/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Clock,
  Gauge,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';

type Dimension = {
  name: string;
  score: number;
  baseline: number;
  description: string;
  status: string;
};

const DIMENSIONS: Dimension[] = [
  {
    name: 'Fluency & Flow',
    score: 78,
    baseline: 54,
    description: '128 words/min tempo, continuous speech run length without blocking',
    status: 'B2 Entry',
  },
  {
    name: 'Coherence & Structure',
    score: 84,
    baseline: 60,
    description: 'Use of logical transitions ("whereas", "consequently", "furthermore")',
    status: 'Solid B2',
  },
  {
    name: 'Lexical Range (Vocab)',
    score: 80,
    baseline: 58,
    description: 'Natural technical collocations, trade-off expressions, precise verbs',
    status: 'Solid B2',
  },
  {
    name: 'Grammatical Accuracy',
    score: 72,
    baseline: 52,
    description: 'Consistent preposition usage, article precision, tense consistency',
    status: 'B1+ Strong',
  },
  {
    name: 'Spontaneous Interaction',
    score: 70,
    baseline: 48,
    description: 'Recovery from unexpected follow-ups, paraphrasing without stalling',
    status: 'B1+ Strong',
  },
];

const BENCHMARKS_HISTORY = [
  {
    date: 'Sep 24, 2026',
    title: 'Bi-Weekly Comprehensive Benchmark',
    level: 'B2 Entry (76/100)',
    latency: '1.3s',
    fluency: '78%',
    status: 'Verified',
  },
  {
    date: 'Sep 17, 2026',
    title: 'Weekly Speaking Check-in',
    level: 'B1+ Strong (68/100)',
    latency: '1.8s',
    fluency: '68%',
    status: 'Completed',
  },
  {
    date: 'Sep 10, 2026',
    title: 'Initial Day 1 Diagnostic',
    level: 'B1 Threshold (54/100)',
    latency: '3.1s',
    fluency: '54%',
    status: 'Baseline',
  },
];

export function ProgressBenchmarksView() {
  const [activeTab, setActiveTab] = useState<'dimensions' | 'acoustics' | 'history'>('dimensions');

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
      {/* Header Context */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              EVIDENCE-BASED PROGRESS
            </span>
            <Chip color="success" size="sm" variant="soft">
              CEFR B1+ ➔ Target B2
            </Chip>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Speaking Analytics & Benchmarks
          </h1>
          <p className="text-sm text-zinc-400">
            Objective acoustic and linguistic metrics. Track response latency, filler words, and
            CEFR progress over time without subjective guesswork.
          </p>
        </div>

        <Button
          className="self-start bg-white text-xs font-semibold text-black shadow-md hover:bg-zinc-200 md:self-auto"
          size="sm"
          variant="primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Start 10-Min Benchmark</span>
        </Button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <Card className="border border-white/[0.08] bg-[#161619] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Speech Latency</span>
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">1.3s</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400">
              <ArrowDownRight className="h-3 w-3" /> -58%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            From 3.1s on Day 1. Faster word retrieval.
          </p>
        </Card>

        {/* Metric 2 */}
        <Card className="border border-white/[0.08] bg-[#161619] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Hesitation Pauses (&gt;2s)</span>
            <Gauge className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">1.6/min</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400">
              <ArrowDownRight className="h-3 w-3" /> -65%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Down from 4.6 pauses per minute.</p>
        </Card>

        {/* Metric 3 */}
        <Card className="border border-white/[0.08] bg-[#161619] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Filler Density</span>
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">1.8%</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400">
              <ArrowDownRight className="h-3 w-3" /> -72%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">"Um", "like", "uh" per 100 words.</p>
        </Card>

        {/* Metric 4 */}
        <Card className="border border-white/[0.08] bg-[#161619] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Re-Speaking Fix Rate</span>
            <Award className="h-3.5 w-3.5" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">84%</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="h-3 w-3" /> Target
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Flagged errors fixed on Attempt 2.</p>
        </Card>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'dimensions'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('dimensions')}
          type="button"
        >
          <span>📊</span> 5 CEFR Dimensions
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'acoustics'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('acoustics')}
          type="button"
        >
          <span>🎯</span> Mistake Elimination Funnel
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            activeTab === 'history'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('history')}
          type="button"
        >
          <span>🗓️</span> Benchmark History
        </button>
      </div>

      {/* Tab 1: 5 Dimensions Breakdown */}
      {activeTab === 'dimensions' && (
        <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                CEFR Speaking Profile Breakdown
              </h3>
              <p className="text-xs text-zinc-400">
                Comparison between your initial Day 1 assessment and current 14-day rolling average.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-zinc-600" />
                <span>Day 1 Baseline</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Current</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {DIMENSIONS.map((dim) => (
              <div
                className="flex flex-col gap-1.5 rounded-xl border border-white/[0.04] bg-black/20 p-3.5"
                key={dim.name}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200">{dim.name}</span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                      {dim.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-semibold">
                    <span className="text-zinc-500">{dim.baseline}</span>
                    <span className="text-zinc-400">➔</span>
                    <span className="text-emerald-400">{dim.score} / 100</span>
                  </div>
                </div>

                {/* Dual Progress Bar */}
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  {/* Baseline marker */}
                  <div
                    className="absolute top-0 bottom-0 z-10 w-0.5 bg-zinc-400"
                    style={{ left: `${dim.baseline}%` }}
                  />
                  {/* Current progress */}
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${dim.score}%` }}
                  />
                </div>

                <p className="text-[11px] text-zinc-400">{dim.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 2: Mistake Elimination Funnel */}
      {activeTab === 'acoustics' && (
        <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Slavicisms & Mistake Elimination Funnel
              </h3>
              <p className="text-xs text-zinc-400">
                Visual proof of fossilized errors moving to Mastered state through spaced
                repetition.
              </p>
            </div>
            <Chip color="success" size="sm" variant="soft">
              26 Mastered / 48 Tracked
            </Chip>
          </div>

          {/* Funnel Progress Bar */}
          <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-emerald-500" style={{ width: '54%' }} title="Mastered: 54%" />
            <div className="bg-amber-500" style={{ width: '29%' }} title="Improving: 29%" />
            <div className="bg-rose-500" style={{ width: '17%' }} title="Active / New: 17%" />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Mastered (26 items · 54%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Practicing (14 items · 29%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span>Active/New (8 items · 17%)</span>
            </div>
          </div>

          {/* High-Impact Mastered Errors */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">
                  "depends of" ➔ "depends on"
                </span>
                <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] text-emerald-400">
                  100% Eliminated
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                Mastered over 12 consecutive turns with zero re-occurrences.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">
                  "make decision" ➔ "make a decision"
                </span>
                <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] text-emerald-400">
                  92% Eliminated
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                Article omission largely resolved during deliberate re-speaking.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 3: Benchmark History */}
      {activeTab === 'history' && (
        <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
          <h3 className="text-base font-semibold text-zinc-100">Historical Benchmarks Log</h3>
          <p className="text-xs text-zinc-400">
            Standardized evaluations taken under timed conditions.
          </p>

          <div className="mt-4 flex flex-col divide-y divide-white/[0.06]">
            {BENCHMARKS_HISTORY.map((item) => (
              <div className="flex items-center justify-between py-3.5 text-xs" key={item.date}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-100">{item.title}</span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                      {item.status}
                    </span>
                  </div>
                  <span className="text-zinc-500">{item.date}</span>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="block font-semibold text-emerald-400">{item.level}</span>
                    <span className="text-[11px] text-zinc-500">Latency: {item.latency}</span>
                  </div>
                  <Button
                    className="border border-white/10 bg-white/[0.04] text-xs text-zinc-300 hover:bg-white/[0.08]"
                    size="sm"
                    variant="secondary"
                  >
                    Report
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
