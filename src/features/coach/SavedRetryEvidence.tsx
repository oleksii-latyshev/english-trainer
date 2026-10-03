import type { AttemptComparison } from '@/lib/types';

export function SavedRetryEvidence({ evidence }: { evidence: AttemptComparison[] }) {
  return (
    <>
      {evidence.map((evidence) => (
        <article className="coach-card my-3" key={`saved-retry-${evidence.turn_sequence}`}>
          <div className="flex items-center justify-between">
            <p className="section-kicker">SAVED TRY AGAIN · TURN {evidence.turn_sequence}</p>
            <span className="metric-pill metric-pill--highlight">
              Target Evidence: {evidence.target_evidence.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="comparison-grid">
            <div className="comparison-column">
              <span className="comparison-label">Attempt 1</span>
              <p className="comparison-text">“{evidence.original_transcript}”</p>
            </div>
            <div className="comparison-column comparison-column--retry">
              <span className="comparison-label">Attempt 2 (Retry)</span>
              <p className="comparison-text">“{evidence.retry_transcript}”</p>
            </div>
          </div>
          <p className="m-0 text-xs text-zinc-500">Hesitation: {evidence.hesitation}</p>
        </article>
      ))}
    </>
  );
}
