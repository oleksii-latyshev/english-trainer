import type { WarmupPhrase } from '../../types';

type Plan = {
  readonly mode: 'voice' | 'text_chat' | 'write_then_speak';
  readonly nextPhrase: WarmupPhrase | undefined;
  readonly warmupFirst: boolean;
};

export function canOfferWarmup(plan: Pick<Plan, 'mode' | 'nextPhrase'>): boolean {
  return plan.mode === 'voice' && plan.nextPhrase !== undefined;
}

export function startsWithWarmup(plan: Plan): boolean {
  return plan.warmupFirst && canOfferWarmup(plan);
}
