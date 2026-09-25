import { Button, Card } from '@heroui/react';
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
    <Card className="panel memory-panel mt-6" variant="secondary">
      <Card.Header className="panel-header flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="section-kicker">PERSISTENT LEARNING MEMORY</p>
          <Card.Title className="section-title text-xl font-bold">
            Mistakes & Phrase Cards
          </Card.Title>
          <p className="mt-1 mb-0 text-xs text-slate-400">
            {view.due_count > 0
              ? `${view.due_count} item${view.due_count === 1 ? '' : 's'} due for review across your sessions.`
              : 'All saved items are up to date.'}
          </p>
        </div>
        {onClose && (
          <Button className="secondary-action text-xs" onPress={onClose} variant="secondary">
            Back to Practice
          </Button>
        )}
      </Card.Header>

      <Card.Content className="panel-content pt-4">
        <div className="mb-4 rounded-md border border-teal-500/20 bg-teal-950/30 p-3 text-xs text-teal-200">
          <p className="m-0 font-medium">About Learning Memory Reviews:</p>
          <p className="mt-1 mb-0 leading-relaxed text-teal-200/80">
            These buttons record your own recall and change the review schedule. A self-report does
            not prove that you can use a phrase while speaking.
          </p>
        </div>

        {fetchError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
            <span>{fetchError}</span>
            <Button
              className="secondary-action text-xs"
              onPress={() => void loadMemory()}
              variant="secondary"
            >
              Retry
            </Button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            className={`text-xs ${filter === 'all' ? 'primary-action' : 'secondary-action'}`}
            onPress={() => setFilter('all')}
            variant={filter === 'all' ? 'primary' : 'secondary'}
          >
            All ({view.mistakes.length + view.phrase_cards.length})
          </Button>
          <Button
            className={`text-xs ${filter === 'due' ? 'primary-action' : 'secondary-action'}`}
            onPress={() => setFilter('due')}
            variant={filter === 'due' ? 'primary' : 'secondary'}
          >
            Due ({view.due_count})
          </Button>
          <Button
            className={`text-xs ${filter === 'mistakes' ? 'primary-action' : 'secondary-action'}`}
            onPress={() => setFilter('mistakes')}
            variant={filter === 'mistakes' ? 'primary' : 'secondary'}
          >
            Mistakes ({view.mistakes.length})
          </Button>
          <Button
            className={`text-xs ${filter === 'phrases' ? 'primary-action' : 'secondary-action'}`}
            onPress={() => setFilter('phrases')}
            variant={filter === 'phrases' ? 'primary' : 'secondary'}
          >
            Phrases ({view.phrase_cards.length})
          </Button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading learning memory…</p>
        ) : !hasItems ? (
          <div className="rounded-lg border border-dashed border-white/10 py-8 text-center">
            <p className="m-0 text-sm text-slate-300">No items saved to Learning Memory yet.</p>
            <p className="mt-1 mb-0 text-xs text-slate-400">
              Review feedback in conversation or use “Save phrase” to build your recall library.
            </p>
          </div>
        ) : !hasFilteredItems ? (
          <div className="rounded-lg border border-dashed border-white/10 py-6 text-center">
            <p className="m-0 text-sm text-slate-400">No items match this filter.</p>
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
      </Card.Content>
    </Card>
  );
}
