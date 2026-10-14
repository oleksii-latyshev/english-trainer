import { useAtomValue } from '@effect/atom-react';
import { Eva } from '@/shared/ui/eva';
import { evaMoodAtom, isAnsweringAtom } from '../../model/view-atoms';
import { AnswerResult } from '../answer-result';
import { IssueNotice } from '../issue-notice';
import { LiveTranscript } from '../live-transcript';
import { MaterialNotice } from '../material-notice';
import { PhraseBar } from '../phrase-bar';
import { SituationCard } from '../situation-card';

type Props = {
  onOpenSettings: () => void;
};

export function ReviewStage({ onOpenSettings }: Props) {
  const mood = useAtomValue(evaMoodAtom);
  const isAnswering = useAtomValue(isAnsweringAtom);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4.5 overflow-y-auto pt-8 pb-4">
      <Eva decorative mood={mood} size={130} />
      <div className="flex w-full max-w-180 flex-col gap-3 px-6">
        <PhraseBar />
        <SituationCard />
        <MaterialNotice />
        <LiveTranscript />
        <AnswerResult />
        {!isAnswering && <IssueNotice onOpenSettings={onOpenSettings} />}
      </div>
    </div>
  );
}
