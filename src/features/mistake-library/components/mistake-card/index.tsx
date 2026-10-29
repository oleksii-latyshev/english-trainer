import { RegistryContext, useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Archive, ArrowLeft, Volume2 } from 'lucide-react';
import { useContext } from 'react';
import { type MistakeDetail, mistakeDetailAtom } from '@/core/mistakes';
import { createPlayback } from '@/core/speech';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { Notice } from '@/shared/ui/notice';
import { archiveMistakeAtom } from '../../model/atoms';
import { Label } from '../label';
import { LadderLine } from '../ladder-line';
import { LessonPanel } from '../lesson-panel';
import { MarkedSentence } from '../marked-sentence';

type Props = {
  id: number;
  isStartingRun: boolean;
  onBack: () => void;
  onArchived: () => void;
  onPractise: () => void;
};

type ActionsProps = {
  mistake: MistakeDetail;
  isStartingRun: boolean;
  onArchived: () => void;
  onPractise: () => void;
};

function Actions({ mistake, isStartingRun, onArchived, onPractise }: ActionsProps) {
  const registry = useContext(RegistryContext);
  const archive = useAtomSet(archiveMistakeAtom);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onPractise} pending={isStartingRun} tone="primary">
        Practise this
      </Button>
      <Button onClick={() => createPlayback(registry).play(mistake.corrected)} tone="secondary">
        <Volume2 aria-hidden="true" />
        Hear it
      </Button>
      <Button
        className="ml-auto"
        onClick={() => archive({ id: mistake.id, onArchived })}
        tone="quiet"
      >
        <Archive aria-hidden="true" />
        Archive
      </Button>
    </div>
  );
}

function Sentences({ mistake }: { mistake: MistakeDetail }) {
  return (
    <>
      <Label>Eva asked</Label>
      <p className="text-body m-0" data-word-lookup>
        {mistake.question}
      </p>
      <Label>You said</Label>
      <p className="text-muted decoration-warn/70 m-0 text-lg line-through" data-word-lookup>
        {mistake.said}
      </p>
      <Label>Version to keep</Label>
      <p className="m-0 text-xl" data-word-lookup>
        <MarkedSentence corrected={mistake.corrected} said={mistake.said} />
      </p>
    </>
  );
}

export function MistakeCard({ id, isStartingRun, onBack, onArchived, onPractise }: Props) {
  const result = useAtomValue(mistakeDetailAtom(id));
  return AsyncResult.match(result, {
    onInitial: () => (
      <Notice role="status" tone="quiet">
        Opening the mistake…
      </Notice>
    ),
    onFailure: () => (
      <Notice role="alert" tone="quiet">
        Could not open this mistake. It may have been removed.
      </Notice>
    ),
    onSuccess: ({ value }) => (
      <div className="flex flex-col gap-4">
        <div className="text-muted flex items-center gap-2">
          <Button onClick={onBack} size="sm" tone="quiet">
            <ArrowLeft aria-hidden="true" />
            Mistakes
          </Button>
          {value.rule && <span>{value.rule.title}</span>}
        </div>
        <div className="max-narrow:grid-cols-1 grid grid-cols-[1.25fr_1fr] items-stretch gap-4">
          <GlassPanel aria-label="Mistake" className="flex flex-col gap-4 p-6">
            <Sentences mistake={value} />
            <Actions
              isStartingRun={isStartingRun}
              mistake={value}
              onArchived={onArchived}
              onPractise={onPractise}
            />
            <LadderLine isFixed={value.fixed_at !== null} ladderStep={value.ladder_step} />
          </GlassPanel>
          <LessonPanel mistake={value} />
        </div>
      </div>
    ),
  });
}
