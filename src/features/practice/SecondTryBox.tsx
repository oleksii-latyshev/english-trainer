import { Button } from '@heroui/react';
import { Check } from 'lucide-react';
import { TurnNotice } from '@/components/TurnNotice';
import { secondTryHint, usedImprovedWording } from '@/features/coach/lib/note';
import type { AttemptComparison } from '@/lib/types';
import { ManualRecorder } from './ManualRecorder';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import type { SecondTryStatus } from './useSecondTry';

type Props = {
  /** The natural version the learner is asked to say. */
  cue: string;
  /** The saved second try of this answer, if there is one. */
  evidence: AttemptComparison | undefined;
  /** This answer is being re-spoken now. */
  isActive: boolean;
  status: SecondTryStatus;
  model: PracticeViewModel;
  actions: PracticeActions;
  onCancel: () => void;
};

function Result({ evidence }: { evidence: AttemptComparison }) {
  const hint = secondTryHint(evidence);
  return (
    <div className="talk-retry">
      <span className="talk-help-caption">Second try</span>
      <p>{evidence.retry_transcript}</p>
      {usedImprovedWording(evidence) && (
        <span className="talk-retry-win">
          <Check aria-hidden="true" size={13} />
          You used “{evidence.target}”
        </span>
      )}
      {hint && <span className="talk-help-caption">{hint}</span>}
    </div>
  );
}

/** The dashed box inside a coaching note: the second try being recorded, or the one saved. */
export function SecondTryBox({ cue, evidence, isActive, status, model, actions, onCancel }: Props) {
  if (!isActive) return evidence ? <Result evidence={evidence} /> : null;
  return (
    <div className="talk-retry">
      <ManualRecorder
        actions={actions}
        cue={cue}
        isEmbedded
        isRetrying
        kicker="Say it again"
        model={model}
        surface="retry"
      />
      {status.tag === 'comparing' && (
        <span className="talk-help-caption" role="status">
          Comparing the two tries…
        </span>
      )}
      {status.tag === 'error' && <TurnNotice message={status.message} />}
      <div className="talk-card-actions">
        <Button onPress={onCancel} size="sm" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}
