import { Button, Chip } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
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
    <section aria-label="Learning use review" className="talk-card">
      <div className="talk-card-header">
        <span className="talk-card-label" data-tone="accent">
          Learning use review
        </span>
        <Chip color="default" size="sm" variant="soft">
          Answer {sequence}
        </Chip>
        {showCheckButton && (
          <Button
            className="ml-auto"
            onPress={() => void handleCheck()}
            size="sm"
            variant="secondary"
          >
            Check learning use
          </Button>
        )}
      </div>
      <p className="talk-help-caption">
        This sends your saved answer transcript and eligible learning targets to your configured AI
        provider. You can keep speaking while it reviews.
      </p>

      {state.tag === 'restoring' && (
        <p className="talk-help-caption">Restoring saved learning review…</p>
      )}
      {state.tag === 'checking' && (
        <p className="talk-help-caption" role="status">
          Checking saved answer with AI…
        </p>
      )}
      {isError && errorMessage && (
        <div className="talk-notice" role="alert">
          <TriangleAlert aria-hidden="true" size={18} />
          <span>{errorMessage}</span>
          <Button
            onPress={() => void (state.tag === 'review-error' ? handleCheck() : handleRestore())}
            size="sm"
            variant="secondary"
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
      <p className="talk-help-caption">
        No eligible earlier learning targets were available for this answer. No progress was
        recorded.
      </p>
    );
  }

  return (
    <div className="talk-help-group">
      {assessment.findings.map((finding) => (
        <div className="talk-focus" key={`${finding.item_type}-${finding.item_id}`}>
          <div className="talk-card-header">
            <strong>Target: “{finding.target}”</strong>
            <span className="ml-auto">
              <FindingOutcome finding={finding} />
            </span>
          </div>
          {finding.exact_excerpt && <p>Saved transcript excerpt: “{finding.exact_excerpt}”</p>}
          <p>Saved item status: {finding.status_after}</p>
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
    // A language mistake is information, never an alarm: no red.
    return (
      <Chip color="warning" size="sm" variant="soft">
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
