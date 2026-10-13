import {
  DeleteMemoryDialog,
  LibraryList,
  MemorySearch,
  StatusSummary,
} from '@/features/memory-library';
import { MistakePracticeCard, ReviewCard } from '@/features/memory-practice';
import type { MemoryScreenProps } from './types';

export function MemoryScreen({
  activeReview,
  isAudioBusy,
  isSessionOpen,
  isStartingMistakePractice,
  mistakePracticeError,
  onStartReview,
  onStartMistakePractice,
}: MemoryScreenProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3.5">
      <header className="flex items-end gap-4 max-narrow:flex-col max-narrow:items-start">
        <div>
          <h1 className="m-0 font-bold text-3xl tracking-tight">Memory</h1>
          <p className="mt-1 mb-0 text-muted">
            Phrases you saved and mistakes Eva noticed. Say them again until they are yours.
          </p>
        </div>
        <div className="ml-auto max-narrow:ml-0 max-narrow:w-full">
          <MemorySearch />
        </div>
      </header>
      <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-3 max-narrow:grid-cols-1">
        <ReviewCard active={activeReview} isAudioBusy={isAudioBusy} onStart={onStartReview} />
        <MistakePracticeCard
          error={mistakePracticeError}
          isAudioBusy={isAudioBusy}
          isSessionOpen={isSessionOpen}
          isStarting={isStartingMistakePractice}
          onStart={onStartMistakePractice}
        />
        <StatusSummary />
      </div>
      <LibraryList />
      <DeleteMemoryDialog />
    </div>
  );
}
