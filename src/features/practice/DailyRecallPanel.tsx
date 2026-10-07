import { Button } from '@heroui/react';
import { TurnNotice } from './TurnNotice';
import type { useDailyRecall } from './useDailyRecall';

type Recall = ReturnType<typeof useDailyRecall>;

type Props = {
  recall: Recall;
  transcript?: string;
  resetCapture: () => void;
  canStart: boolean;
  canLeave: boolean;
};

function RecallResult({ recall }: { recall: Recall }) {
  const { result, currentItem } = recall;
  if (!result) return null;
  return (
    <div className="talk-help-group" role="status">
      <p className="talk-help-text">You said: {result.transcript}</p>
      <p className="talk-help-text">Saved phrase: {result.target}</p>
      <p className="talk-help-text">
        {result.wording_observed
          ? 'The saved wording appears in your transcript.'
          : 'The full saved wording was not found in your transcript.'}{' '}
        This text check is not a pronunciation or mastery score.
      </p>
      <div className="talk-card-actions">
        {currentItem ? (
          <Button onPress={recall.next} size="sm" variant="secondary">
            Next phrase
          </Button>
        ) : (
          <Button onPress={recall.leave} size="sm" variant="secondary">
            Return to conversation
          </Button>
        )}
      </div>
    </div>
  );
}

export function DailyRecallPanel({ recall, transcript, resetCapture, canStart, canLeave }: Props) {
  const { state, active, currentItem, result } = recall;
  return (
    <section aria-label="Spoken phrase recall" className="talk-card">
      <div className="talk-card-label" data-tone="accent">
        Spoken phrase recall
      </div>
      <p className="talk-help-text">
        Review a phrase from an earlier session. Recall is optional. Its result is saved as
        transcript evidence; it does not grant mastery automatically.
      </p>
      {state.tag === 'loading' && (
        <p className="talk-help-text" role="status">
          Loading due phrases…
        </p>
      )}
      {state.tag === 'error' && (
        <TurnNotice message={state.message}>
          <Button onPress={() => void recall.reload()} size="sm" variant="secondary">
            Retry loading
          </Button>
        </TurnNotice>
      )}
      {state.tag === 'ready' && (
        <p className="talk-help-text">
          {state.plan.completed_count} spoken recall{' '}
          {state.plan.completed_count === 1 ? 'attempt' : 'attempts'} saved this session.
        </p>
      )}
      {state.tag === 'ready' && !currentItem && !result && (
        <p className="talk-help-text">
          No more due phrases with a usable cue. You can finish practice.
        </p>
      )}
      {state.tag === 'ready' && currentItem && !active && (
        <div className="talk-card-actions">
          <Button isDisabled={!canStart} onPress={recall.start} size="sm" variant="secondary">
            Start spoken recall
          </Button>
        </div>
      )}
      {active && currentItem && !result && (
        <div className="talk-help-group">
          <p className="talk-help-text">
            Cue: <strong>{currentItem.cue}</strong>
          </p>
          <p className="talk-help-caption">
            Record your phrase with the microphone above, transcribe it locally, then save this
            attempt.
          </p>
          {recall.saveError && <TurnNotice message={recall.saveError} />}
          <div className="talk-card-actions">
            {transcript && (
              <Button
                isDisabled={recall.saving}
                onPress={() => void recall.submit(currentItem.phrase_id, transcript, resetCapture)}
                size="sm"
                variant="primary"
              >
                {recall.saving ? 'Saving recall…' : 'Save spoken recall'}
              </Button>
            )}
            <Button
              isDisabled={recall.saving || !canLeave}
              onPress={() => {
                resetCapture();
                recall.leave();
              }}
              size="sm"
              variant="ghost"
            >
              Leave recall
            </Button>
          </div>
        </div>
      )}
      <RecallResult recall={recall} />
    </section>
  );
}
