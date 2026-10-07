import { Button } from '@heroui/react';
import { type ReactNode, useEffect, useState } from 'react';
import { ReviewSession } from '@/features/memory/components/ReviewSession';
import { getLearningMemory } from '@/features/memory/memoryApi';
import { startMemoryReview } from '@/features/memory/memoryRecallApi';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { LearningStatus } from '@/lib/learningTypes';
import type { MemoryReviewRun } from '@/lib/memoryRecallTypes';
import './review.css';

type Props = {
  speech: ReturnType<typeof useSystemSpeech>;
  onBackToMemory: () => void;
  onStartTalk: () => void;
  onOpenSettings: () => void;
};

type Load =
  | { tag: 'loading' }
  | { tag: 'nothing-to-review' }
  | { tag: 'error' }
  | { tag: 'ready'; run: MemoryReviewRun; statusBefore: ReadonlyMap<string, LearningStatus> };

/** Where every item stands before the review changes it; a failed read only hides the status chip. */
async function readStatusBefore(): Promise<Map<string, LearningStatus>> {
  const statuses = new Map<string, LearningStatus>();
  try {
    const memory = await getLearningMemory();
    for (const card of memory.phrase_cards) statuses.set(`phrase:${card.id}`, card.status);
    for (const mistake of memory.mistakes) statuses.set(`mistake:${mistake.id}`, mistake.status);
  } catch {
    // The chip is a nicety; the review works without it.
  }
  return statuses;
}

function Notice({ title, hint, actions }: { title: string; hint: string; actions: ReactNode }) {
  return (
    <div className="review-notice">
      <h1>{title}</h1>
      <p>{hint}</p>
      <div className="review-notice-actions">{actions}</div>
    </div>
  );
}

/** Opens the review: resumes a saved run or starts one from what is due. */
export function SpokenReview({ speech, onBackToMemory, onStartTalk, onOpenSettings }: Props) {
  const [load, setLoad] = useState<Load>({ tag: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // `attempt` is the retry: changing it opens the review again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry trigger, not a value the effect reads.
  useEffect(() => {
    let isCurrent = true;
    const open = async () => {
      try {
        // Starting returns the saved run when there is one, so this also resumes.
        const [run, statusBefore] = await Promise.all([startMemoryReview(), readStatusBefore()]);
        if (!isCurrent) return;
        setLoad(run ? { tag: 'ready', run, statusBefore } : { tag: 'nothing-to-review' });
      } catch {
        if (isCurrent) setLoad({ tag: 'error' });
      }
    };
    void open();
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  return (
    <div className="review-screen">
      {load.tag === 'loading' && (
        <p className="review-status" role="status">
          Getting your review ready…
        </p>
      )}
      {load.tag === 'nothing-to-review' && (
        <Notice
          actions={
            <Button onPress={onBackToMemory} variant="primary">
              Back to Memory
            </Button>
          }
          hint="Nothing due has a cue that is safe to practise out loud yet. Your saved items are unchanged."
          title="Nothing to review right now"
        />
      )}
      {load.tag === 'error' && (
        <Notice
          actions={
            <>
              <Button
                onPress={() => {
                  setLoad({ tag: 'loading' });
                  setAttempt((count) => count + 1);
                }}
                variant="primary"
              >
                Try again
              </Button>
              <Button onPress={onBackToMemory} variant="secondary">
                Back to Memory
              </Button>
            </>
          }
          hint="Your saved items are unchanged. Try again in a moment."
          title="Could not start the review"
        />
      )}
      {load.tag === 'ready' && (
        <ReviewSession
          initialRun={load.run}
          onBackToMemory={onBackToMemory}
          onOpenSettings={onOpenSettings}
          onStartTalk={onStartTalk}
          speech={speech}
          statusBefore={load.statusBefore}
        />
      )}
    </div>
  );
}
