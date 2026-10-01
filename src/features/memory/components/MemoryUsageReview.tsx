import { Button, Chip } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { getPracticeMemoryUsage, reviewPracticeMemoryUsage } from '@/features/memory/memoryApi';
import type { TurnUsageAssessment } from '@/lib/usageTypes';

type Props = {
  sessionId: number;
  sequence: number;
};

type ReviewState =
  | { tag: 'restoring' }
  | { tag: 'idle' }
  | { tag: 'checking' }
  | { tag: 'restore-error'; message: string }
  | { tag: 'review-error'; message: string }
  | { tag: 'success'; key: string; assessment: TurnUsageAssessment };

export function MemoryUsageReview({ sessionId, sequence }: Props) {
  const [state, setState] = useState<ReviewState>({ tag: 'restoring' });
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const activeCheckIdRef = useRef(0);
  const checkingKeyRef = useRef<string | null>(null);
  const requestKey = `${sessionId}:${sequence}`;

  useEffect(() => {
    mountedRef.current = true;
    const generation = ++generationRef.current;
    setState({ tag: 'restoring' });

    void getPracticeMemoryUsage(sessionId, sequence)
      .then((assessment) => {
        if (!mountedRef.current || generationRef.current !== generation) return;
        setState(assessment ? { tag: 'success', key: requestKey, assessment } : { tag: 'idle' });
      })
      .catch(() => {
        if (!mountedRef.current || generationRef.current !== generation) return;
        setState({
          tag: 'restore-error',
          message: 'Could not restore this saved review. Retry to check for an earlier result.',
        });
      });

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, [sessionId, sequence, requestKey]);

  async function handleCheck() {
    if (checkingKeyRef.current === requestKey) return;
    const generation = ++generationRef.current;
    const checkId = ++activeCheckIdRef.current;
    checkingKeyRef.current = requestKey;
    setState({ tag: 'checking' });

    try {
      const assessment = await reviewPracticeMemoryUsage(sessionId, sequence);
      if (!mountedRef.current || generationRef.current !== generation) return;
      setState({ tag: 'success', key: requestKey, assessment });
    } catch {
      if (!mountedRef.current || generationRef.current !== generation) return;
      setState({
        tag: 'review-error',
        message: 'Could not complete the learning use review. Please retry.',
      });
    } finally {
      if (activeCheckIdRef.current === checkId) checkingKeyRef.current = null;
    }
  }

  async function handleRestore() {
    const generation = ++generationRef.current;
    setState({ tag: 'restoring' });
    try {
      const assessment = await getPracticeMemoryUsage(sessionId, sequence);
      if (!mountedRef.current || generationRef.current !== generation) return;
      setState(assessment ? { tag: 'success', key: requestKey, assessment } : { tag: 'idle' });
    } catch {
      if (!mountedRef.current || generationRef.current !== generation) return;
      setState({
        tag: 'restore-error',
        message: 'Could not restore this saved review. Please retry.',
      });
    }
  }

  if (sequence > 2) return null;
  const assessment = state.tag === 'success' && state.key === requestKey ? state.assessment : null;
  const showCheckButton = state.tag === 'idle' || state.tag === 'review-error';
  const isError = state.tag === 'restore-error' || state.tag === 'review-error';
  const errorMessage = isError ? state.message : null;

  return (
    <section
      className="mt-4 rounded-xl border border-purple-500/20 bg-purple-950/10 p-4"
      aria-label="Learning use review"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-purple-300 uppercase">
              LEARNING USE REVIEW
            </span>
            <Chip color="default" size="sm" variant="soft">
              Answer {sequence}
            </Chip>
          </div>
          <p className="mt-1 mb-0 text-xs text-zinc-400">
            This sends your saved answer transcript and eligible learning targets to your configured
            AI provider. You can keep speaking while it reviews.
          </p>
        </div>
        {showCheckButton && (
          <Button
            className="self-start border border-purple-500/40 bg-purple-500/20 text-xs text-purple-200 hover:bg-purple-500/30 md:self-auto"
            onPress={() => void handleCheck()}
            size="sm"
          >
            Check learning use
          </Button>
        )}
      </div>

      {state.tag === 'restoring' && (
        <p className="mt-3 mb-0 text-xs text-zinc-500">Restoring saved learning review…</p>
      )}
      {state.tag === 'checking' && (
        <p className="mt-3 mb-0 text-xs text-zinc-400" role="status">
          Checking saved answer with AI…
        </p>
      )}
      {isError && errorMessage && (
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5 text-xs text-rose-200"
          role="alert"
        >
          <span>{errorMessage}</span>
          <Button
            className="border border-rose-500/40 bg-rose-500/20 text-xs text-rose-200"
            onPress={() => void (state.tag === 'review-error' ? handleCheck() : handleRestore())}
            size="sm"
          >
            Retry
          </Button>
        </div>
      )}
      {assessment && <AssessmentResult assessment={assessment} />}
    </section>
  );
}

function AssessmentResult({ assessment }: { assessment: TurnUsageAssessment }) {
  if (assessment.findings.length === 0) {
    return (
      <p className="mt-3 mb-0 text-xs italic text-zinc-400">
        No eligible earlier learning targets were available for this answer. No progress was
        recorded.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-2">
      {assessment.findings.map((finding) => (
        <div
          key={`${finding.item_type}-${finding.item_id}`}
          className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-zinc-200">Target: “{finding.target}”</span>
            <FindingOutcome finding={finding} />
          </div>
          {finding.exact_excerpt && (
            <p className="mt-1 mb-0 text-[11px] text-zinc-400">
              <span className="text-zinc-500">Saved transcript excerpt:</span> “
              {finding.exact_excerpt}”
            </p>
          )}
          <p className="mt-1 mb-0 text-[11px] text-zinc-500">
            Saved item status: {finding.status_after}
          </p>
        </div>
      ))}
    </div>
  );
}

function FindingOutcome({ finding }: { finding: TurnUsageAssessment['findings'][number] }) {
  if (finding.outcome === 'correct' && finding.credited) {
    return (
      <Chip color="success" size="sm" variant="soft">
        Correct use credited
      </Chip>
    );
  }
  if (finding.outcome === 'incorrect' && finding.credited) {
    return (
      <Chip color="danger" size="sm" variant="soft">
        Incorrect use observed
      </Chip>
    );
  }
  if (finding.outcome === 'uncertain') {
    return (
      <Chip color="default" size="sm" variant="soft">
        Uncertain / no progress
      </Chip>
    );
  }
  return (
    <Chip color="default" size="sm" variant="soft">
      No progress recorded
    </Chip>
  );
}
