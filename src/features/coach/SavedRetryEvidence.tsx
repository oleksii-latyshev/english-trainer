import { Check } from 'lucide-react';
import type { AttemptComparison } from '@/lib/types';

export function SavedRetryEvidence({ evidence }: { evidence: AttemptComparison[] }) {
  return (
    <>
      {evidence.map((item) => (
        <article
          aria-label={`Saved second try for answer ${item.turn_sequence}`}
          className="talk-aside talk-aside-wide"
          key={`saved-retry-${item.turn_sequence}`}
        >
          <div className="talk-retry">
            <span className="talk-help-caption">Second try · answer {item.turn_sequence}</span>
            <p>“{item.retry_transcript}”</p>
            <span className="talk-help-caption">First try: “{item.original_transcript}”</span>
            <span className="talk-retry-win">
              <Check aria-hidden="true" size={13} />
              Target wording: {item.target_evidence.replace(/_/g, ' ')}
            </span>
            <span className="talk-help-caption">Hesitation: {item.hesitation}</span>
          </div>
        </article>
      ))}
    </>
  );
}
