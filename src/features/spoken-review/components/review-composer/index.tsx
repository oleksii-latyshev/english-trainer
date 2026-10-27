import { useAtomValue } from '@effect/atom-react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Kbd } from '@/shared/ui/kbd';
import { LevelMeter } from '@/shared/ui/level-meter';
import { RecordButton } from '@/shared/ui/record-button';
import { phaseAtom } from '../../model/prompt-atoms';
import { useReviewCommands } from '../../model/use-review-commands';
import {
  isSecondaryDisabledAtom,
  isTryingAgainAtom,
  levelAtom,
  micCopyAtom,
} from '../../model/view-atoms';
import { IssueNotice } from '../issue-notice';

type Props = {
  onOpenSettings: () => void;
};

export function ReviewComposer({ onOpenSettings }: Props) {
  const copy = useAtomValue(micCopyAtom);
  const phase = useAtomValue(phaseAtom);
  const level = useAtomValue(levelAtom);
  const isTryingAgain = useAtomValue(isTryingAgainAtom);
  const isSecondaryDisabled = useAtomValue(isSecondaryDisabledAtom);
  const commands = useReviewCommands();
  const isLive = phase === 'listening';

  return (
    <section
      aria-label="Your answer"
      className="rounded-card border-line bg-surface shadow-overlay backdrop-blur-glass data-live:border-accent-line mx-auto flex w-full max-w-168 flex-col gap-2 border px-3 py-2.5 backdrop-saturate-170"
      data-live={isLive || undefined}
    >
      <IssueNotice onOpenSettings={onOpenSettings} />
      <div className="flex items-center gap-3.5">
        <RecordButton
          aria-label={copy.name}
          disabled={!copy.isPressable}
          onClick={commands.pressMic}
          state={copy.variant}
        >
          {copy.icon === 'stop' ? (
            <Square aria-hidden="true" fill="currentColor" />
          ) : (
            <Mic aria-hidden="true" />
          )}
        </RecordButton>
        <div className="flex min-w-0 flex-1 flex-col gap-0.75" role="status">
          <span className="font-semibold">{copy.title}</span>
          <span className="text-caption text-faint">{copy.hint}</span>
        </div>
        <LevelMeter label="Microphone level" level={isLive ? level : 0} />
        <Kbd>Space</Kbd>
        <Button
          disabled={isSecondaryDisabled}
          onClick={commands.pressSecondary}
          size="sm"
          tone="secondary"
        >
          {isTryingAgain ? 'Cancel' : 'Skip'}
        </Button>
      </div>
    </section>
  );
}
