import { useState } from 'react';
import {
  canStart,
  DEFAULT_SELECTION,
  LengthChoice,
  ModeChoice,
  type PracticeSelection,
  StartBar,
  StartError,
  StartGreeting,
  TopicChoice,
  toPracticeOptions,
} from '@/features/practice-setup';
import { canOfferWarmup, startsWithWarmup, WarmupCard } from '@/features/review-warmup';
import { ResumeCard } from '@/features/session-resume';
import { ActivityCard, WeekCard } from '@/features/speaking-activity';
import { UsualMistakesCard } from '@/features/usual-mistakes';
import type { TalkStartScreenProps } from './types';

export function TalkStartScreen({
  status,
  error,
  openSession,
  review,
  mistakePractice,
  onStart,
  onStartWarmup,
  onContinue,
  onOpenMemory,
  onPracticeMistakes,
}: TalkStartScreenProps) {
  const [selection, setSelection] = useState<PracticeSelection>(DEFAULT_SELECTION);
  const [warmupFirst, setWarmupFirst] = useState(false);
  const isIdle = status === 'ready';
  const nextPhrase = review?.nextPhrase;

  function change(patch: Partial<PracticeSelection>) {
    setSelection((current) => ({ ...current, ...patch }));
  }

  function start(pick: 'chosen' | 'random' = 'chosen') {
    const options = toPracticeOptions(selection, pick);
    const warmsUp = startsWithWarmup({ mode: selection.mode, nextPhrase, warmupFirst });
    if (warmsUp) onStartWarmup(options);
    else onStart(options);
  }

  return (
    <div className="max-narrow:flex-col mx-auto flex max-w-6xl gap-3">
      <section className="flex max-w-190 min-w-0 flex-1 flex-col gap-5">
        <StartGreeting />
        {openSession ? (
          <ResumeCard
            isDisabled={status === 'restoring'}
            onContinue={onContinue}
            session={openSession}
          />
        ) : (
          <>
            <ModeChoice
              disabled={!isIdle}
              onChange={(mode) => change({ mode })}
              value={selection.mode}
            />
            <TopicChoice disabled={!isIdle} onChange={change} selection={selection} />
          </>
        )}
        <ActivityCard />
        {!openSession && (
          <div className="mt-auto flex flex-wrap items-end gap-4">
            <LengthChoice
              disabled={!isIdle}
              onChange={(duration) => change({ duration })}
              value={selection.duration}
            />
            <StartBar
              canStart={canStart(selection)}
              mode={selection.mode}
              onRandom={() => start('random')}
              onStart={() => start()}
              status={status}
            />
          </div>
        )}
        {error && (
          <StartError
            isRetryDisabled={!isIdle}
            message={error}
            onRetry={openSession ? undefined : () => start()}
          />
        )}
      </section>
      <aside className="max-narrow:w-full flex w-85 flex-none flex-col gap-3">
        {review && (
          <WarmupCard
            dueCount={review.dueCount}
            isWarmupOffered={!openSession && canOfferWarmup({ mode: selection.mode, nextPhrase })}
            nextPhrase={nextPhrase}
            onReview={onOpenMemory}
            onWarmupFirstChange={setWarmupFirst}
            warmupFirst={warmupFirst}
          />
        )}
        {mistakePractice && mistakePractice.mistakes.length > 0 && (
          <UsualMistakesCard
            blockedReason={mistakePractice.blockedReason}
            isStarting={mistakePractice.isStarting}
            mistakes={mistakePractice.mistakes}
            onPractice={onPracticeMistakes}
          />
        )}
        <WeekCard />
      </aside>
    </div>
  );
}
