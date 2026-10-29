import { type MistakeGroups, type RuleKey, repeatedRules } from '@/core/mistakes';

export type UsualRule = {
  readonly key: RuleKey;
  readonly title: string;
  readonly count: number;
};

const SHOWN_RULES = 3;

export function usualRules(groups: MistakeGroups): readonly UsualRule[] {
  return [...repeatedRules(groups)]
    .sort((a, b) => b.mistake_count - a.mistake_count)
    .slice(0, SHOWN_RULES)
    .map((group) => ({ key: group.rule_key, title: group.title, count: group.mistake_count }));
}
