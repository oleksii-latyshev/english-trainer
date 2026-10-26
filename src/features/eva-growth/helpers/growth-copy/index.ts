import { type EvaGrowthSnapshot, STAGES, stageInfo, toEvaStage } from '@/core/eva-growth';
import type { EvaMood, EvaStage } from '@/shared/ui/eva';

export type StageProgress = {
  stageName: string;
  counts: string;
  footer: string;
  summary: string;
  value: number;
  max: number;
  isFullBloom: boolean;
};

type Gain = { drops: number };

export function dropsLabel(count: number): string {
  return count === 1 ? '1 drop' : `${count} drops`;
}

export function stageProgress(growth: EvaGrowthSnapshot): StageProgress {
  const stage = stageInfo(toEvaStage(growth.stage));
  if (growth.next_threshold === null) {
    return {
      stageName: stage.name,
      counts: dropsLabel(growth.drops),
      footer: 'In full bloom',
      summary: 'In full bloom',
      value: 1,
      max: 1,
      isFullBloom: true,
    };
  }
  const span = growth.next_threshold - growth.stage_floor;
  const within = growth.drops - growth.stage_floor;
  const next = stageInfo(toEvaStage(growth.stage + 1));
  return {
    stageName: stage.name,
    counts: `${within} / ${dropsLabel(span)}`,
    footer: `${dropsLabel(span - within)} to ${next.name}`,
    summary: `${within} / ${dropsLabel(span)} to ${next.name}`,
    value: within,
    max: span,
    isFullBloom: false,
  };
}

export function gainAmount(gain: Gain): string {
  return `+${gain.drops}`;
}

export function speakingGainLabel(gain: { drops: number; topic: string }): string {
  const topic = gain.topic.trim();
  return topic === '' ? `${gain.drops} min of talk` : `${gain.drops} min about ${topic}`;
}

export function sunshineGainLabel(gain: { phrase: string }): string {
  return `Said “${gain.phrase}” on your own`;
}

export const EMPTY_TODAY = 'Nothing yet today. One minute spoken is one drop.';

export type StripState = 'reached' | 'here' | 'ahead';

export type StripEntry = {
  stage: EvaStage;
  name: string;
  need: string;
  state: StripState;
  mood: EvaMood;
  marker: string;
};

const STRIP_MOODS = ['idle', 'idle', 'idle', 'happy', 'happy', 'happy'] as const;

function stripState(stage: EvaStage, current: EvaStage): StripState {
  if (stage === current) return 'here';
  return stage < current ? 'reached' : 'ahead';
}

export function stageStrip(current: EvaStage): StripEntry[] {
  return STAGES.map((entry) => {
    const state = stripState(entry.stage, current);
    return {
      ...entry,
      state,
      mood: STRIP_MOODS[entry.stage],
      marker: state === 'here' ? 'You are here' : '',
    };
  });
}

export type GrowthRule = { id: 'drops' | 'sunshine' | 'days-off'; title: string; body: string };

export const GROWTH_RULES: readonly GrowthRule[] = [
  {
    id: 'drops',
    title: 'Drops — you speak',
    body: 'Every minute you talk to Eva is one drop. Only speaking counts, so the plant grows exactly as much as your English does.',
  },
  {
    id: 'sunshine',
    title: 'Sunshine — it sticks',
    body: 'When you use a saved phrase on your own, without help, Eva gets sunshine: +5 drops, once per phrase in a conversation.',
  },
  {
    id: 'days-off',
    title: 'Days off — Eva naps',
    body: 'Take a full day off and she is simply asleep. Nothing wilts, nothing is lost, no streak to break. She wakes up happy to see you.',
  },
];
