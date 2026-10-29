import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { type RuleKey, ruleCardAtom } from '@/core/mistakes';

type Props = { ruleKey: RuleKey };

export function RuleDetails({ ruleKey }: Props) {
  const card = useAtomValue(ruleCardAtom(ruleKey));
  return AsyncResult.match(card, {
    onInitial: () => <p className="m-0">Loading the rule…</p>,
    onFailure: () => <p className="m-0">Could not open this rule. Please try again.</p>,
    onSuccess: ({ value }) => (
      <>
        {value.body && (
          <p className="m-0" data-word-lookup>
            {value.body}
          </p>
        )}
        {value.examples.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-word-lookup>
            {value.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        )}
      </>
    ),
  });
}
