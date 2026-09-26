import { Button, Card, Chip } from '@heroui/react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';

type InterviewPackId = 'hr' | 'tech' | 'system_design' | 'star';

type Scenario = {
  id: string;
  packId: InterviewPackId;
  title: string;
  interviewer: {
    name: string;
    role: string;
    avatar: string;
    company: string;
  };
  question: string;
  targetVocab: string[];
  optimalTimeSeconds: number;
  starSuggestions: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
};

const SCENARIOS: Record<InterviewPackId, Scenario> = {
  tech: {
    id: 'tech-1',
    packId: 'tech',
    title: 'Incident Post-Mortem & Performance Bottleneck',
    interviewer: {
      name: 'David Vance',
      role: 'Staff Infrastructure Architect',
      avatar: '👨‍💻',
      company: 'Core Cloud Platform',
    },
    question:
      'Tell me about a time when a production service you owned suffered severe latency degradation. How did you isolate the bottleneck and mitigate it under pressure?',
    targetVocab: ['bottleneck', 'connection pool', 'p99 latency', 'mitigate', 'degradation'],
    optimalTimeSeconds: 90,
    starSuggestions: {
      situation: 'Black Friday traffic spike, payment API p99 latency rose to 3.2s',
      task: 'Lead emergency triage and restore response times below 150ms',
      action:
        'Analyzed flame graphs, identified DB connection pool exhaustion, added read replicas',
      result: 'Restored p99 latency to 85ms with zero data loss',
    },
  },
  system_design: {
    id: 'system-1',
    packId: 'system_design',
    title: 'Distributed Rate Limiting at Scale',
    interviewer: {
      name: 'David Vance',
      role: 'Staff Infrastructure Architect',
      avatar: '👨‍💻',
      company: 'Core Cloud Platform',
    },
    question:
      'We need to rate-limit 100,000 incoming requests per second across 5 global regions with minimal latency overhead. What architectural trade-offs would you make?',
    targetVocab: ['trade-off', 'token bucket', 'eventual consistency', 'throughput', 'overhead'],
    optimalTimeSeconds: 120,
    starSuggestions: {
      situation: 'Global API gateway subject to DDoS and client quota abuse',
      task: 'Design a resilient rate limiter with sub-5ms local evaluation',
      action: 'Combined local in-memory token buckets with Redis Cluster periodic sync',
      result: 'Prevented downstream service brownouts while keeping 99th percentile overhead < 2ms',
    },
  },
  hr: {
    id: 'hr-1',
    packId: 'hr',
    title: 'Career Trajectory & Technical Direction',
    interviewer: {
      name: 'Elena Rostova',
      role: 'Principal Talent Partner',
      avatar: '👩‍💼',
      company: 'Talent & Culture',
    },
    question:
      'Walk me through why you chose to specialize in backend engineering, and what kind of technical challenges you are looking to tackle in your next role.',
    targetVocab: ['trajectory', 'ownership', 'distributed systems', 'deep dive', 'impact'],
    optimalTimeSeconds: 90,
    starSuggestions: {
      situation: 'Transitioned from broad full-stack to high-throughput backend services',
      task: 'Focus on distributed data consistency and resilience',
      action: 'Built real-time telemetry systems and led architectural redesigns',
      result: 'Looking to own core infrastructural pipelines in scale-up environments',
    },
  },
  star: {
    id: 'star-1',
    packId: 'star',
    title: 'Disagree and Commit with Product',
    interviewer: {
      name: 'Sarah Chen',
      role: 'VP of Engineering',
      avatar: '👩‍🔬',
      company: 'Product Engineering',
    },
    question:
      'Describe a situation where product management pushed for a critical feature deadline, but engineering found significant architectural risk. How did you resolve the disagreement?',
    targetVocab: ['compromise', 'technical debt', 'mitigate risk', 'stakeholders', 'alignment'],
    optimalTimeSeconds: 100,
    starSuggestions: {
      situation: 'Product wanted launch in 2 weeks despite unaddressed schema migrations',
      task: 'Protect database integrity without blocking business launch commitments',
      action:
        'Proposed a 2-phase release: phased rollout with feature flags and background migration',
      result:
        'Shipped on schedule with zero downtime and established a standard migration playbook',
    },
  },
};

type Props = {
  onStartPractice?: () => void;
};

export function HotSeatInterviewView({ onStartPractice }: Props) {
  const [selectedPack, setSelectedPack] = useState<InterviewPackId>('tech');
  const [isAnswering, setIsAnswering] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(48);
  const [simulatedTranscript, setSimulatedTranscript] = useState(
    'Last year, our payment processing API latency spiked from 45ms to 3.2 seconds during peak traffic. My responsibility was to lead the emergency triage, identify the root cause, and restore normal latency. By inspecting flame graphs, I discovered our database connection pool was exhausted due to unindexed queries...',
  );
  const [starCovered, setStarCovered] = useState({
    situation: true,
    task: true,
    action: true,
    result: false,
  });

  const scenario = SCENARIOS[selectedPack];
  const progressPercent = Math.min(
    100,
    Math.round((elapsedSeconds / scenario.optimalTimeSeconds) * 100),
  );

  function toggleAnswering() {
    setIsAnswering((prev) => !prev);
    if (!isAnswering) {
      setElapsedSeconds(0);
    }
  }

  function handleReplayQuestion() {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(scenario.question);
      utterance.rate = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
      {/* Header Context */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            THE HOT SEAT
          </span>
          <Chip color="danger" size="sm" variant="soft">
            High Pressure
          </Chip>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Professional Interview Simulator
        </h1>
        <p className="text-sm text-zinc-400">
          Realistic technical and behavioral interview pressure. Practice structure, concise timing,
          and B2+ technical vocabulary under the clock.
        </p>
      </div>

      {/* Pack Selection Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            selectedPack === 'tech'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setSelectedPack('tech')}
          type="button"
        >
          <span>💻</span> Technical Deep-Dive
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            selectedPack === 'system_design'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setSelectedPack('system_design')}
          type="button"
        >
          <span>🏗️</span> System Design
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            selectedPack === 'star'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setSelectedPack('star')}
          type="button"
        >
          <span>🌟</span> Behavioral (STAR)
        </button>
        <button
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
            selectedPack === 'hr'
              ? 'border border-white/20 bg-white/10 text-white shadow-sm'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          onClick={() => setSelectedPack('hr')}
          type="button"
        >
          <span>🏢</span> HR & Screening
        </button>
      </div>

      {/* Interviewer Persona Card */}
      <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
              {scenario.interviewer.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-100">
                  {scenario.interviewer.name}
                </h3>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                  {scenario.interviewer.company}
                </span>
              </div>
              <p className="text-xs text-zinc-400">{scenario.interviewer.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="border border-white/10 bg-white/[0.05] text-xs text-zinc-300 hover:bg-white/10"
              onPress={handleReplayQuestion}
              size="sm"
              variant="secondary"
            >
              <Volume2 className="h-3.5 w-3.5 text-zinc-400" />
              <span>Hear Question Aloud</span>
            </Button>
            {onStartPractice && (
              <Button
                className="border border-white/10 bg-white/[0.05] text-xs text-zinc-300 hover:bg-white/10"
                onPress={onStartPractice}
                size="sm"
                variant="secondary"
              >
                <span>Practice in Session</span>
              </Button>
            )}
          </div>
        </div>

        {/* Question Prompt */}
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-4">
          <p className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            QUESTION PROMPT
          </p>
          <p className="mt-1.5 text-base leading-relaxed font-medium text-zinc-100">
            "{scenario.question}"
          </p>
        </div>

        {/* Target Technical Collocations */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Target Vocabulary:</span>
          {scenario.targetVocab.map((vocab) => {
            const isUsed = simulatedTranscript.toLowerCase().includes(vocab.toLowerCase());
            return (
              <Chip
                className={`text-xs ${
                  isUsed
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-zinc-400'
                }`}
                key={vocab}
                size="sm"
                variant="soft"
              >
                {isUsed ? '✓ ' : ''}
                {vocab}
              </Chip>
            );
          })}
        </div>
      </Card>

      {/* STAR Framework Live Tracker */}
      <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <h4 className="text-sm font-semibold text-zinc-200">STAR Structure Checklist</h4>
          </div>
          <span className="text-xs text-zinc-400">
            {Object.values(starCovered).filter(Boolean).length} / 4 elements covered
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className={`rounded-xl border p-3 transition-colors ${
              starCovered.situation
                ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : 'border-white/[0.06] bg-black/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-4 w-4 ${
                  starCovered.situation ? 'text-emerald-400' : 'text-zinc-600'
                }`}
              />
              <span className="text-xs font-semibold text-zinc-200">S: Situation</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{scenario.starSuggestions.situation}</p>
          </div>

          <div
            className={`rounded-xl border p-3 transition-colors ${
              starCovered.task
                ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : 'border-white/[0.06] bg-black/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-4 w-4 ${starCovered.task ? 'text-emerald-400' : 'text-zinc-600'}`}
              />
              <span className="text-xs font-semibold text-zinc-200">T: Task</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{scenario.starSuggestions.task}</p>
          </div>

          <div
            className={`rounded-xl border p-3 transition-colors ${
              starCovered.action
                ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : 'border-white/[0.06] bg-black/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-4 w-4 ${starCovered.action ? 'text-emerald-400' : 'text-zinc-600'}`}
              />
              <span className="text-xs font-semibold text-zinc-200">A: Action</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{scenario.starSuggestions.action}</p>
          </div>

          <div
            className={`rounded-xl border p-3 transition-colors ${
              starCovered.result
                ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : 'border-amber-500/30 bg-amber-500/[0.06]'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle
                className={`h-4 w-4 ${starCovered.result ? 'text-emerald-400' : 'text-amber-400'}`}
              />
              <span className="text-xs font-semibold text-zinc-200">R: Result (Metrics)</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              Needs concrete metric impact (e.g. "p99 dropped by 90%")
            </p>
          </div>
        </div>
      </Card>

      {/* Answer Canvas & Recording Bar */}
      <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg">
        {/* Timer Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span>
              Pacing: {Math.floor(elapsedSeconds / 60)}:
              {(elapsedSeconds % 60).toString().padStart(2, '0')} /{' '}
              {Math.floor(scenario.optimalTimeSeconds / 60)}:
              {(scenario.optimalTimeSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <span className="text-xs text-zinc-400">
            {elapsedSeconds <= scenario.optimalTimeSeconds ? 'Optimal concise window' : 'Wrap up'}
          </span>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-all duration-300 ${
              progressPercent > 90 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Live Transcript Stream */}
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/40 p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              YOUR SPOKEN TRANSCRIPT
            </span>
            {isAnswering && (
              <span className="flex items-center gap-1.5 text-xs text-rose-400">
                <span className="h-2 w-2 animate-ping rounded-full bg-rose-500" />
                Listening locally (Whisper Metal)
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-zinc-200">
            {simulatedTranscript || (
              <span className="text-zinc-500 italic">
                Press Speak to begin your structured response...
              </span>
            )}
          </p>
        </div>

        {/* Push to Talk Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              className={`min-h-[46px] rounded-xl px-6 text-sm font-semibold transition-all ${
                isAnswering
                  ? 'border border-rose-500/50 bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                  : 'bg-white text-black shadow-md hover:bg-zinc-200 active:scale-[0.98]'
              }`}
              onPress={toggleAnswering}
              variant="primary"
            >
              {isAnswering ? (
                <>
                  <MicOff className="h-4 w-4" /> Stop & Evaluate Answer
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" /> Speak Answer (Hold Space)
                </>
              )}
            </Button>

            <Button
              className="border border-white/10 bg-white/[0.04] text-xs text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
              onPress={() => {
                setElapsedSeconds(0);
                setSimulatedTranscript('');
                setStarCovered({
                  situation: false,
                  task: false,
                  action: false,
                  result: false,
                });
              }}
              size="sm"
              variant="secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          </div>

          <div className="text-right text-xs text-zinc-400">
            <span>Shortcut: </span>
            <kbd className="rounded border border-white/20 bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
              Space
            </kbd>
            <span className="ml-1">PTT</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
