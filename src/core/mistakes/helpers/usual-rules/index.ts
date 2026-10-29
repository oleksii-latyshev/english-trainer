import type { MistakeGroup, MistakeGroups } from '../../types';

const MIN_MISTAKES_PER_RULE = 2;

export function repeatedRules(groups: MistakeGroups): readonly MistakeGroup[] {
  return groups.groups.filter((group) => group.mistake_count >= MIN_MISTAKES_PER_RULE);
}
