import type { MistakeGroup } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { Disclosure } from '@/shared/ui/disclosure';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { ProgressBar } from '@/shared/ui/progress-bar';
import { fixedLabel, moreLabel, relapseLabel, SHOWN_MISTAKES } from '../../helpers/group-copy';
import { MistakeRow } from '../mistake-row';
import { RuleDetails } from '../rule-details';

type Props = {
  group: MistakeGroup;
  isStartingRun: boolean;
  onOpen: (id: number) => void;
  onPractise: () => void;
};

export function RuleGroup({ group, isStartingRun, onOpen, onPractise }: Props) {
  const relapse = relapseLabel(group);
  const fixed = fixedLabel(group);
  const more = moreLabel(group);
  const headingId = `rule-${group.rule_key}`;
  return (
    <GlassPanel aria-labelledby={headingId} className="flex flex-col overflow-hidden">
      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-body m-0 font-bold" id={headingId}>
            {group.title}
          </h2>
          {relapse && <Chip tone="warning">{relapse}</Chip>}
          {fixed && <Chip tone="success">{fixed}</Chip>}
          <span className="ml-auto">
            <Chip>{group.mistake_count}</Chip>
          </span>
        </div>
        <p className="text-control text-muted m-0" data-word-lookup>
          {group.summary}
        </p>
        <ProgressBar
          label={`${group.fixed_count} of ${group.mistake_count} fixed`}
          max={group.mistake_count}
          value={group.fixed_count}
        />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {group.mistakes.slice(0, SHOWN_MISTAKES).map((mistake) => (
            <li key={mistake.id}>
              <MistakeRow mistake={mistake} onOpen={onOpen} />
            </li>
          ))}
        </ul>
        {more && <p className="text-control text-faint m-0">{more}</p>}
        <div className="flex justify-end">
          <Button onClick={onPractise} pending={isStartingRun} tone="secondary">
            Practise this rule
          </Button>
        </div>
      </div>
      <Disclosure summary="Open the full rule">
        <RuleDetails ruleKey={group.rule_key} />
      </Disclosure>
    </GlassPanel>
  );
}
