import { Button } from '@heroui/react';
import { Play } from 'lucide-react';
import { useTrainer } from '@/context/TrainerContext';
import type { AnswerPlan } from '@/lib/answerPlanTypes';

function panelMessage(hasError: boolean, errorMessage: string | null, isLoading: boolean): string {
  if (hasError) return errorMessage ?? 'Answer help is unavailable. You can keep speaking.';
  if (isLoading) return 'Preparing help for this question…';
  return 'Answer help is available in the desktop app.';
}

export function GuidedAnswerPanel({
  plan,
  isLoading,
  hasError,
  errorMessage,
  isRecording,
  onRetry,
  onHide,
}: {
  plan: AnswerPlan | null;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
  isRecording: boolean;
  onRetry: () => void;
  onHide: () => void;
}) {
  const { speech } = useTrainer();
  if (!plan) {
    return (
      <div className="talk-help-group">
        <p className="talk-help-text" role={hasError ? 'status' : undefined}>
          {panelMessage(hasError, errorMessage, isLoading)}
        </p>
        {hasError && (
          <div className="talk-help-actions">
            <Button onPress={onRetry} size="sm" variant="secondary">
              Retry help
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="talk-help-group">
      <div className="talk-help-caption">Model answer — try your own version after reading</div>
      <p className="talk-help-example">{plan.model_answer}</p>
      <div className="talk-help-actions">
        <Button
          isDisabled={isRecording}
          onPress={() => speech.play(plan.model_answer)}
          size="sm"
          variant="secondary"
        >
          <Play aria-hidden="true" fill="currentColor" size={12} />
          Play
        </Button>
        <Button
          onPress={() => {
            speech.stop();
            onHide();
          }}
          size="sm"
          variant="ghost"
        >
          Hide before speaking
        </Button>
      </div>
    </div>
  );
}
