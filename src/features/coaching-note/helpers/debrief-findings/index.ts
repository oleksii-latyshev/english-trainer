import type { TurnFeedback } from '../../types';

type Finding = {
  readonly said: string;
  readonly better: string;
  readonly note: string;
};

export type FindingGroup = {
  readonly kind: 'fix' | 'better' | 'gap';
  readonly label: 'Fix' | 'Better' | 'Missing word';
  readonly findings: readonly Finding[];
};

const NATURAL_LINE = 'This answer already sounds natural.';

export function findingGroups(feedback: TurnFeedback): readonly FindingGroup[] {
  const groups: FindingGroup[] = [
    {
      kind: 'fix',
      label: 'Fix',
      findings: feedback.focus_feedback.map((item) => ({
        said: item.original,
        better: item.improved,
        note: item.explanation,
      })),
    },
    {
      kind: 'better',
      label: 'Better',
      findings: feedback.upgrades.map((item) => ({
        said: item.original,
        better: item.improved,
        note: item.explanation,
      })),
    },
    {
      kind: 'gap',
      label: 'Missing word',
      findings: feedback.gaps.map((item) => ({
        said: item.original,
        better: item.word,
        note: item.meaning,
      })),
    },
  ];
  return groups.filter((group) => group.findings.length > 0);
}

export function reasonLine(feedback: TurnFeedback): string {
  const [first] = findingGroups(feedback).flatMap((group) => group.findings);
  return first?.note ?? NATURAL_LINE;
}
