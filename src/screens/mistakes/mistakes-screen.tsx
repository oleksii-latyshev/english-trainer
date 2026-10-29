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
  isStartingRun,
  talkError,
  onTalkItThrough,
  onOpenMistake,
  onPractise,
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
            isStartingRun={isStartingRun}
            onPractise={() => onPractise({ kind: 'due' })}
            onTalkItThrough={onTalkItThrough}
          />
        </div>
      </header>
      <MistakeGroups
        isStartingRun={isStartingRun}
        onOpen={onOpenMistake}
        onPractiseRule={(ruleKey) => onPractise({ kind: 'rule', ruleKey })}
      />
    </div>
  );
}

export function MistakeCardScreen({
  mistakeId,
  isStartingRun,
  onBack,
  onPractise,
}: MistakeCardScreenProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <MistakeCard
        id={mistakeId}
        isStartingRun={isStartingRun}
        onArchived={onBack}
        onBack={onBack}
        onPractise={() => onPractise({ kind: 'one', id: mistakeId })}
      />
    </div>
  );
}
