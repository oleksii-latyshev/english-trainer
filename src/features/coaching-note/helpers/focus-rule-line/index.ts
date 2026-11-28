import type { FocusRule } from '../../types';

export function focusRuleLine(rule: FocusRule): string {
  const times = rule.in_session === 1 ? '1 time' : `${rule.in_session} times`;
  return `${times} in this conversation · ${rule.open} open`;
}
