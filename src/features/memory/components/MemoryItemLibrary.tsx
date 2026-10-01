import { Button, Card } from '@heroui/react';
import { MistakeCard } from '@/features/memory/components/MistakeCard';
import { PhraseCardItem } from '@/features/memory/components/PhraseCardItem';
import { filterMemoryItems, type MemoryFilter } from '@/features/memory/lib/memoryState';
import type { LearningMemoryView, ReviewResponse } from '@/lib/learningTypes';

type Props = {
  view: LearningMemoryView;
  loading: boolean;
  fetchError: string | null;
  filter: MemoryFilter;
  onFilterChange: (filter: MemoryFilter) => void;
  onRetryLoad: () => void;
  onMistakeReview: (id: number, response: ReviewResponse) => Promise<void>;
  onPhraseReview: (id: number, response: ReviewResponse) => Promise<void>;
};

export function MemoryItemLibrary({
  view,
  loading,
  fetchError,
  filter,
  onFilterChange,
  onRetryLoad,
  onMistakeReview,
  onPhraseReview,
}: Props) {
  const filtered = filterMemoryItems(view, filter);
  return (
    <Card className="border border-white/[0.08] bg-[#161619] p-5 shadow-lg" variant="secondary">
      <div className="mb-4 rounded-xl border border-white/[0.06] bg-black/30 p-3 text-xs text-zinc-400">
        <p className="m-0 font-medium text-zinc-300">About Spaced Repetition (SRS) Reviews:</p>
        <p className="mt-1 mb-0 leading-relaxed text-zinc-400">
          Self-reported recall updates schedule intervals. Voice review checks whether target
          wording appears in a transcript; it does not assess spontaneous conversational use.
        </p>
      </div>
      {fetchError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
          <span>{fetchError}</span>
          <Button
            className="border border-rose-500/30 bg-rose-500/20 text-xs text-rose-200"
            onPress={onRetryLoad}
            size="sm"
            variant="secondary"
          >
            Retry
          </Button>
        </div>
      )}
      <MemoryFilterTabs view={view} filter={filter} onChange={onFilterChange} />
      <MemoryItemsContent
        view={view}
        filtered={filtered}
        loading={loading}
        onMistakeReview={onMistakeReview}
        onPhraseReview={onPhraseReview}
      />
    </Card>
  );
}

function MemoryFilterTabs({
  view,
  filter,
  onChange,
}: {
  view: LearningMemoryView;
  filter: MemoryFilter;
  onChange: (filter: MemoryFilter) => void;
}) {
  const tabs: { value: MemoryFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All Items', count: view.mistakes.length + view.phrase_cards.length },
    { value: 'due', label: 'Due for Review', count: view.due_count },
    { value: 'mistakes', label: 'Mistakes Vault', count: view.mistakes.length },
    { value: 'phrases', label: 'Phrase Cards', count: view.phrase_cards.length },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          aria-pressed={filter === tab.value}
          className={
            filter === tab.value
              ? 'rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all'
              : 'rounded-xl px-3.5 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-zinc-200'
          }
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}

function MemoryItemsContent({
  view,
  filtered,
  loading,
  onMistakeReview,
  onPhraseReview,
}: {
  view: LearningMemoryView;
  filtered: ReturnType<typeof filterMemoryItems>;
  loading: boolean;
  onMistakeReview: Props['onMistakeReview'];
  onPhraseReview: Props['onPhraseReview'];
}) {
  if (loading)
    return <p className="py-8 text-center text-sm text-zinc-500">Loading learning memory…</p>;
  if (!view.mistakes.length && !view.phrase_cards.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
        <p className="m-0 text-sm font-medium text-zinc-300">
          No items saved to Learning Memory yet.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Complete a practice session or save phrases from feedback to populate your library.
        </p>
      </div>
    );
  }
  if (!filtered.mistakes.length && !filtered.phraseCards.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center">
        <p className="m-0 text-sm text-zinc-400">No items match this filter.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {filtered.mistakes.map((mistake) => (
        <MistakeCard key={`mistake-${mistake.id}`} mistake={mistake} onReview={onMistakeReview} />
      ))}
      {filtered.phraseCards.map((phrase) => (
        <PhraseCardItem key={`phrase-${phrase.id}`} onReview={onPhraseReview} phraseCard={phrase} />
      ))}
    </div>
  );
}
