import { Button, Card } from '@heroui/react';
import type { useDailyRecall } from './useDailyRecall';

type Recall = ReturnType<typeof useDailyRecall>;

type Props = {
  recall: Recall;
  transcript?: string;
  resetCapture: () => void;
  canStart: boolean;
  canLeave: boolean;
};

export function DailyRecallPanel({ recall, transcript, resetCapture, canStart, canLeave }: Props) {
  const { state, active, currentItem, result } = recall;
  return (
    <Card className="panel mt-5" variant="secondary">
      <Card.Header>
        <div>
          <p className="section-kicker">SPOKEN PHRASE RECALL</p>
          <Card.Title>Review a phrase from an earlier session</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="space-y-3 text-sm text-slate-300">
        <p className="m-0">
          Recall is optional. Its result is saved as transcript evidence; it does not grant mastery
          automatically.
        </p>
        {state.tag === 'loading' && <p role="status">Loading due phrases…</p>}
        {state.tag === 'error' && (
          <div role="alert">
            <p>{state.message}</p>
            <Button onPress={() => void recall.reload()} variant="secondary">
              Retry loading
            </Button>
          </div>
        )}
        {state.tag === 'ready' && (
          <p className="m-0">
            {state.plan.completed_count} spoken recall{' '}
            {state.plan.completed_count === 1 ? 'attempt' : 'attempts'} saved this session.
          </p>
        )}
        {state.tag === 'ready' && !currentItem && !result && (
          <p className="m-0">No more due phrases with a usable cue. You can finish practice.</p>
        )}
        {state.tag === 'ready' && currentItem && !active && (
          <Button isDisabled={!canStart} onPress={recall.start} variant="secondary">
            Start spoken recall
          </Button>
        )}
        {active && currentItem && !result && (
          <div className="space-y-3">
            <p className="m-0">
              Cue: <strong>{currentItem.cue}</strong>
            </p>
            <p className="m-0 text-xs text-slate-400">
              Record your phrase with the microphone controls above, transcribe it locally, then
              save this attempt.
            </p>
            {transcript && (
              <Button
                isDisabled={recall.saving}
                onPress={() => void recall.submit(currentItem.phrase_id, transcript, resetCapture)}
                variant="primary"
              >
                {recall.saving ? 'Saving recall…' : 'Save spoken recall'}
              </Button>
            )}
            {recall.saveError && (
              <p className="error-message" role="alert">
                {recall.saveError}
              </p>
            )}
            <Button
              isDisabled={recall.saving || !canLeave}
              onPress={() => {
                resetCapture();
                recall.leave();
              }}
              variant="secondary"
            >
              Leave recall
            </Button>
          </div>
        )}
        {result && (
          <div className="space-y-2" role="status">
            <p className="m-0">You said: {result.transcript}</p>
            <p className="m-0">Saved phrase: {result.target}</p>
            <p className="m-0">
              {result.wording_observed
                ? 'The saved wording appears in your transcript.'
                : 'The full saved wording was not found in your transcript.'}{' '}
              This text check is not a pronunciation or mastery score.
            </p>
            {currentItem ? (
              <Button onPress={recall.next} variant="secondary">
                Next phrase
              </Button>
            ) : (
              <Button onPress={recall.leave} variant="secondary">
                Return to conversation
              </Button>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
