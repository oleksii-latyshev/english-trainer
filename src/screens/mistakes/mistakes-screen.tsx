import {
  MistakeCard,
  MistakeGroups,
  OverviewLine,
  PracticeActions,
} from '@/features/mistake-library';
import type { MistakeCardScreenProps, MistakesScreenProps } from './types';

export function MistakesScreen({
  talkBlockedReason,
  isStartingTalk,
  talkError,
  onTalkItThrough,
  onOpenMistake,
}: MistakesScreenProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="max-narrow:flex-col max-narrow:items-start flex items-end gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-tight">Mistakes</h1>
          <OverviewLine />
        </div>
        <div className="max-narrow:ml-0 ml-auto">
          <PracticeActions
            blockedReason={talkBlockedReason}
            error={talkError}
            isStarting={isStartingTalk}
            onTalkItThrough={onTalkItThrough}
          />
        </div>
      </header>
      <MistakeGroups onOpen={onOpenMistake} />
    </div>
  );
}

export function MistakeCardScreen({ mistakeId, onBack }: MistakeCardScreenProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <MistakeCard id={mistakeId} onArchived={onBack} onBack={onBack} />
    </div>
  );
}
