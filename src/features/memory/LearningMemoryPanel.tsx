import { Button, Card, Chip } from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import type { LearningMemoryView, ReviewResponse } from '@/lib/learningTypes';
import { MistakeCard } from './components/MistakeCard';
import { PhraseCardItem } from './components/PhraseCardItem';
import { applyReviewResult, filterMemoryItems, type MemoryFilter } from './lib/memoryState';
import { getLearningMemory, submitLearningReview } from './memoryApi';

type Props = {
  onClose?: () => void;
};

export function LearningMemoryPanel({ onClose }: Props) {
  const [view, setView] = useState<LearningMemoryView>({
    mistakes: [],
    phrase_cards: [],
    due_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MemoryFilter>('all');

  const loadMemory = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getLearningMemory();
      setView(data);
    } catch {
      setFetchError('Could not load Learning Memory from local storage. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemory();
    const refreshMemory = () => void loadMemory();
    window.addEventListener('learning-memory-changed', refreshMemory);
    return () => window.removeEventListener('learning-memory-changed', refreshMemory);
  }, [loadMemory]);

  async function handleMistakeReview(id: number, response: ReviewResponse) {
    const result = await submitLearningReview('mistake', id, response);
    setView((current) => applyReviewResult(current, result));
  }

  async function handlePhraseReview(id: number, response: ReviewResponse) {
    const result = await submitLearningReview('phrase', id, response);
    setView((current) => applyReviewResult(current, result));
  }

  const filtered = filterMemoryItems(view, filter);
  const hasItems = view.mistakes.length > 0 || view.phrase_cards.length > 0;
  const hasFilteredItems = filtered.mistakes.length > 0 || filtered.phraseCards.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
      {/* Header Context */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              PERSISTENT KNOWLEDGE BANK
            </span>
            <Chip color={view.due_count > 0 ? 'warning' : 'success'} size="sm" variant="soft">
              {view.due_count > 0 ? `${view.due_count} Due for Review` : 'All Caught Up'}
            </Chip>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Learning Memory & Mistake Vault
          </h1>
          <p className="text-sm text-zinc-400">
            Long-term Spaced Repetition (SRS) for corrected Slavicisms, high-value collocations, and
            vocabulary recorded from your speaking sessions.
          </p>
        </div>

        {onClose && (
          <Button
            className="self-start border border-white/10 bg-white/[0.06] text-xs text-zinc-200 hover:bg-white/10 md:self-auto"
            onPress={onClose}
            size="sm"
            variant="secondary"
          >
            Back to Practice
          </Button>
        )}
      </div>

      <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg" variant="secondary">
        {/* Memory Explanation Callout */}
        <div className="mb-4 rounded-xl border border-white/[0.06] bg-black/30 p-3 text-xs text-zinc-400">
          <p className="m-0 font-medium text-zinc-300">About Spaced Repetition (SRS) Reviews:</p>
          <p className="mt-1 mb-0 leading-relaxed text-zinc-400">
            Self-reported recall updates schedule intervals. For verified spoken mastery, use the
            due phrases during your next guided session's recall phase.
          </p>
        </div>

        {fetchError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
            <span>{fetchError}</span>
            <Button
              className="border border-rose-500/30 bg-rose-500/20 text-xs text-rose-200"
              onPress={() => void loadMemory()}
              size="sm"
              variant="secondary"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Filter Segmented Controls */}
        <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
          <button
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
              filter === 'all'
                ? 'border border-white/20 bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
            onClick={() => setFilter('all')}
            type="button"
          >
            All Items ({view.mistakes.length + view.phrase_cards.length})
          </button>
          <button
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
              filter === 'due'
                ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-sm'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
            onClick={() => setFilter('due')}
            type="button"
          >
            Due for Review ({view.due_count})
          </button>
          <button
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
              filter === 'mistakes'
                ? 'border border-white/20 bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
            onClick={() => setFilter('mistakes')}
            type="button"
          >
            Mistakes Vault ({view.mistakes.length})
          </button>
          <button
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
              filter === 'phrases'
                ? 'border border-white/20 bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
            onClick={() => setFilter('phrases')}
            type="button"
          >
            Phrase Cards ({view.phrase_cards.length})
          </button>
        </div>

        {/* Content Section */}
        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Loading learning memory…</p>
        ) : !hasItems ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
            <p className="m-0 text-sm font-medium text-zinc-300">
              No items saved to Learning Memory yet.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Complete a practice session or save phrases from feedback to populate your library.
            </p>
          </div>
        ) : !hasFilteredItems ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center">
            <p className="m-0 text-sm text-zinc-400">No items match this filter.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.mistakes.map((mistake) => (
              <MistakeCard
                key={`mistake-${mistake.id}`}
                mistake={mistake}
                onReview={handleMistakeReview}
              />
            ))}
            {filtered.phraseCards.map((phrase) => (
              <PhraseCardItem
                key={`phrase-${phrase.id}`}
                onReview={handlePhraseReview}
                phraseCard={phrase}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
