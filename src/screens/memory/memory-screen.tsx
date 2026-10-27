import {
  DeleteMemoryDialog,
  LibraryList,
  MemorySearch,
  StatusSummary,
} from '@/features/memory-library';
import { MistakePracticeCard, ReviewCard } from '@/features/memory-practice';
import type { MemoryScreenProps } from './types';

export function MemoryScreen({
  isAudioBusy,
  isSessionOpen,
  isStartingMistakePractice,
  mistakePracticeError,
  onStartReview,
  onStartMistakePractice,
}: MemoryScreenProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3.5">
      <header className="max-narrow:flex-col max-narrow:items-start flex items-end gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-tight">Memory</h1>
          <p className="text-muted mt-1 mb-0">
            Phrases you saved and mistakes Eva noticed. Say them again until they are yours.
          </p>
        </div>
        <div className="max-narrow:ml-0 max-narrow:w-full ml-auto">
          <MemorySearch />
        </div>
      </header>
      <div className="max-narrow:grid-cols-1 grid grid-cols-[1.6fr_1fr_1fr] gap-3">
        <ReviewCard isAudioBusy={isAudioBusy} onStart={onStartReview} />
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
