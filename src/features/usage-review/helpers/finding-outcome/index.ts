import type { UsageFinding } from '../../types';

export type FindingOutcome = {
  readonly label: string;
  readonly tone: 'success' | 'warning' | 'neutral';
};

export function findingOutcome(finding: UsageFinding): FindingOutcome {
  if (finding.outcome === 'correct' && finding.credited) {
    return { label: 'Correct use credited', tone: 'success' };
  }
  if (finding.outcome === 'incorrect' && finding.credited) {
    return { label: 'Incorrect use observed', tone: 'warning' };
  }
  if (finding.outcome === 'with_help') {
    return { label: 'Used with help / no progress', tone: 'neutral' };
  }
  if (finding.outcome === 'uncertain') return { label: 'Uncertain / no progress', tone: 'neutral' };
  return { label: 'No progress recorded', tone: 'neutral' };
}
