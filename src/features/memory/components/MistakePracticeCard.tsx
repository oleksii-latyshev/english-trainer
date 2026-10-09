import { Button } from '@heroui/react';
import { Mic2 } from 'lucide-react';
import './mistakePracticeCard.css';

type Props = {
  eligibleCount: number;
  isAudioBusy: boolean;
  isLibraryReady: boolean;
  isLibraryError: boolean;
  isSessionOpen: boolean;
  isStarting: boolean;
  error: string;
  onStart: () => void;
};

function disabledReason(props: Props): string {
  if (props.isLibraryError) return 'Reload Memory to check your repeated mistakes.';
  if (!props.isLibraryReady) return 'Your repeated mistakes are still loading.';
  if (props.isSessionOpen) return 'Continue or finish the current conversation first.';
  if (props.isAudioBusy) return 'Wait for the microphone to become available.';
  if (props.eligibleCount === 0) return 'Mistakes need to appear at least twice first.';
  return '';
}

export function MistakePracticeCard(props: Props) {
  const reason = disabledReason(props);
  const isDisabled = Boolean(reason) || props.isStarting;

  return (
    <section aria-labelledby="mistake-practice-title" className="memory-mistake-practice">
      <div className="memory-mistake-practice-icon">
        <Mic2 aria-hidden="true" size={20} />
      </div>
      <div className="memory-mistake-practice-copy">
        <h2 id="mistake-practice-title">Practice my usual mistakes</h2>
        <p>5 short questions · About 2 minutes</p>
        {reason && <p className="memory-mistake-practice-hint">{reason}</p>}
        {props.isStarting && (
          <p aria-live="polite" className="memory-mistake-practice-hint">
            Preparing five questions…
          </p>
        )}
        {props.error && (
          <p className="memory-mistake-practice-error" role="alert">
            {props.error}
          </p>
        )}
      </div>
      <Button
        className="memory-mistake-practice-action"
        isDisabled={isDisabled}
        onPress={props.onStart}
        variant="primary"
      >
        {props.isStarting ? 'Preparing…' : 'Start practice'}
      </Button>
    </section>
  );
}
