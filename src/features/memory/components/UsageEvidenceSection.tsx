import { Button, Chip } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMemoryUsageEvidence } from '@/features/memory/memoryApi';
import type { LearningItemType } from '@/lib/learningTypes';
import type { MemoryUsageEvidence } from '@/lib/usageTypes';

type Props = {
  itemType: LearningItemType;
  itemId: number;
};

type EvidenceState =
  | { tag: 'idle' }
  | { tag: 'loading'; key: string }
  | { tag: 'error'; key: string; message: string }
  | { tag: 'loaded'; key: string; evidence: MemoryUsageEvidence };

export function UsageEvidenceSection({ itemType, itemId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [fetchState, setFetchState] = useState<EvidenceState>({ tag: 'idle' });
  const requestIdRef = useRef(0);
  const requestKey = `${itemType}:${itemId}`;

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    [],
  );

  const loadEvidence = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const key = `${itemType}:${itemId}`;
    setFetchState({ tag: 'loading', key });
    try {
      const data = await getMemoryUsageEvidence(itemType, itemId);
      if (requestIdRef.current !== requestId) return;
      setFetchState({ tag: 'loaded', key, evidence: data });
    } catch {
      if (requestIdRef.current !== requestId) return;
      setFetchState({
        tag: 'error',
        key,
        message: 'Could not load usage evidence. Please retry.',
      });
    }
  }, [itemType, itemId]);

  useEffect(() => {
    requestIdRef.current += 1;
    setFetchState((current) =>
      'key' in current && current.key === requestKey ? current : { tag: 'idle' },
    );
  }, [requestKey]);

  useEffect(() => {
    if (!isOpen) return;
    const reload = () => void loadEvidence();
    reload();
    window.addEventListener('learning-memory-changed', reload);
    return () => {
      window.removeEventListener('learning-memory-changed', reload);
      requestIdRef.current += 1;
    };
  }, [isOpen, loadEvidence]);

  function handleToggle() {
    if (isOpen) {
      requestIdRef.current += 1;
      setFetchState({ tag: 'idle' });
    }
    setIsOpen(!isOpen);
  }

  const stateMatchesRequest = 'key' in fetchState && fetchState.key === requestKey;

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-2.5">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-xs font-medium text-zinc-400 hover:text-zinc-200"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <span>Usage evidence</span>
        <span className="text-[11px] text-zinc-500">{isOpen ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {isOpen && (
        <div className="mt-2.5 rounded-lg border border-white/[0.04] bg-black/30 p-3 text-xs">
          {fetchState.tag === 'loading' && stateMatchesRequest && (
            <p className="m-0 text-zinc-500">Loading conversational usage evidence…</p>
          )}

          {fetchState.tag === 'error' && stateMatchesRequest && (
            <div className="flex items-center justify-between gap-2 text-rose-300">
              <span>{fetchState.message}</span>
              <Button
                className="text-[11px] border border-rose-500/30 bg-rose-500/10"
                size="sm"
                onPress={() => void loadEvidence()}
                variant="secondary"
              >
                Retry
              </Button>
            </div>
          )}

          {fetchState.tag === 'loaded' && stateMatchesRequest && (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3 text-zinc-400">
                <span>
                  Distinct sessions:{' '}
                  <strong className="text-zinc-200">
                    {fetchState.evidence.distinct_session_count}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Streak: <strong className="text-zinc-200">{fetchState.evidence.streak}</strong>
                </span>
              </div>

              {fetchState.evidence.events.length === 0 ? (
                <p className="m-0 text-zinc-500 italic">
                  No conversational usage evidence recorded yet. Use this phrasing in your practice
                  sessions to build mastery.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="m-0 text-[11px] font-medium text-zinc-400 uppercase">
                    Recent conversational observations (last {fetchState.evidence.events.length}):
                  </p>
                  <div className="grid gap-1.5">
                    {fetchState.evidence.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded border border-white/[0.04] bg-white/[0.02] p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Chip
                            color={ev.outcome === 'correct' ? 'success' : 'danger'}
                            size="sm"
                            variant="soft"
                          >
                            {ev.outcome === 'correct' ? 'Correct use' : 'Incorrect / Relapse'}
                          </Chip>
                          <span className="text-[10px] text-zinc-500">
                            Session #{ev.session_id} ·{' '}
                            {new Date(ev.original_turn_time).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 mb-0 text-[10px] text-zinc-500">
                          Answer {ev.sequence} ·{' '}
                          {ev.origin === 'feedback' ? 'Focused feedback' : 'AI usage review'}
                        </p>
                        {ev.exact_excerpt && (
                          <p className="mt-1 mb-0 text-[11px] text-zinc-300">
                            <span className="text-zinc-500">Excerpt:</span> "{ev.exact_excerpt}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-2.5 mb-0 text-[10px] text-zinc-500">
                Supported transcript usage wording only. Does not imply phonetic pronunciation
                grading or official CEFR certification.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
