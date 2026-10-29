import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { mistakeGroupsAtom } from '@/core/mistakes';
import { overviewLine, totalMistakes } from '../../helpers/group-copy';

export function OverviewLine() {
  const groups = Option.getOrNull(AsyncResult.value(useAtomValue(mistakeGroupsAtom)));
  const text =
    groups && totalMistakes(groups) > 0
      ? overviewLine(groups)
      : 'Short lessons for the mistakes Eva noticed, grouped by rule.';
  return <p className="text-muted mt-1 mb-0">{text}</p>;
}
