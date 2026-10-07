import { Button } from '@heroui/react';
import { useEffect, useState } from 'react';
import { getMemoryUsageEvidence } from '@/features/memory/memoryApi';
import type { LearningItemType } from '@/lib/learningTypes';
import type { MemoryUsageEvidence } from '@/lib/usageTypes';
import '@/features/memory/memoryDetail.css';

type Props = {
  itemType: LearningItemType;
  itemId: number;
};

type EvidenceState =
  | { tag: 'loading' }
  | { tag: 'error' }
  | { tag: 'loaded'; evidence: MemoryUsageEvidence };

/**
 * What conversations showed about one item (the usage-review subsystem's evidence). Read-only;
 * it loads when the row opens and reloads when Memory changes.
 */
export function UsageEvidenceSection({ itemType, itemId }: Props) {
  const [state, setState] = useState<EvidenceState>({ tag: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // `attempt` is the retry: changing it runs the load again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry trigger, not a value the effect reads.
  useEffect(() => {
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const evidence = await getMemoryUsageEvidence(itemType, itemId);
        if (request === generation) setState({ tag: 'loaded', evidence });
      } catch {
        if (request === generation) setState({ tag: 'error' });
      }
    };
    const reload = () => void load();
    reload();
    window.addEventListener('learning-memory-changed', reload);
    return () => {
      generation += 1;
      window.removeEventListener('learning-memory-changed', reload);
    };
  }, [itemType, itemId, attempt]);

  return (
    <section aria-label="Evidence from conversations" className="evidence">
      {state.tag === 'loading' && <p className="evidence-empty">Loading evidence…</p>}
      {state.tag === 'error' && (
        <div className="evidence-error" role="alert">
          <span>Could not load the evidence from conversations.</span>
          <Button onPress={() => setAttempt((count) => count + 1)} size="sm" variant="secondary">
            Retry
          </Button>
        </div>
      )}
      {state.tag === 'loaded' && <EvidenceBody evidence={state.evidence} />}
    </section>
  );
}

function EvidenceBody({ evidence }: { evidence: MemoryUsageEvidence }) {
  return (
    <>
      <div className="evidence-head">
        <span className="evidence-title">In conversations</span>
        <span>
          Sessions: <strong>{evidence.distinct_session_count}</strong>
        </span>
        <span>
          Streak: <strong>{evidence.streak}</strong>
        </span>
      </div>
      {evidence.events.length === 0 ? (
        <p className="evidence-empty">
          Nothing yet. Use this wording in a conversation and it shows up here.
        </p>
      ) : (
        <ul className="evidence-list">
          {evidence.events.map((event) => (
            <li className="evidence-event" key={event.id}>
              <div className="evidence-event-meta">
                <span className="evidence-outcome" data-outcome={event.outcome}>
                  {event.outcome === 'correct' ? 'Used correctly' : 'Slipped back'}
                </span>
                <span>
                  Session {event.session_id} · answer {event.sequence} ·{' '}
                  {event.origin === 'feedback' ? 'from Eva’s note' : 'from the usage review'}
                </span>
                <span>{new Date(event.original_turn_time).toLocaleString()}</span>
              </div>
              {event.exact_excerpt && <p className="evidence-excerpt">“{event.exact_excerpt}”</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="evidence-note">
        Based on the words in your transcripts. It says nothing about pronunciation or a level.
      </p>
    </>
  );
}
