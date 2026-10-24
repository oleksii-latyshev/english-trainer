import type { AttemptComparison } from '../../types';

export function usedImprovedWording(comparison: AttemptComparison): boolean {
  return (
    comparison.target.length > 0 &&
    (comparison.target_evidence === 'newly_observed_in_retry' ||
      comparison.target_evidence === 'already_present_in_both')
  );
}

export function secondTryHint(comparison: AttemptComparison): string {
  if (comparison.target.length === 0) return '';
  switch (comparison.target_evidence) {
    case 'partially_observed':
      return `Close. Part of “${comparison.target}” was there.`;
    case 'not_observed':
      return `Try “${comparison.target}” once more.`;
    default:
      return '';
  }
}
