import { Play } from 'lucide-react';
import { useSpeech } from '@/core/speech';
import type { AnswerPlan } from '@/lib/answerPlanTypes';
import { Button } from '@/shared/ui/button';

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
  const speech = useSpeech();
  if (!plan) {
    return (
      <div className="talk-help-group">
        <p className="talk-help-text" role={hasError ? 'status' : undefined}>
          {panelMessage(hasError, errorMessage, isLoading)}
        </p>
        {hasError && (
          <div className="talk-help-actions">
            <Button onClick={onRetry} size="sm" tone="secondary">
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
          disabled={isRecording}
          onClick={() => speech.play(plan.model_answer)}
          size="sm"
          tone="secondary"
        >
          <Play aria-hidden="true" fill="currentColor" size={12} />
          Play
        </Button>
        <Button
          onClick={() => {
            speech.stop();
            onHide();
          }}
          size="sm"
          tone="quiet"
        >
          Hide before speaking
        </Button>
      </div>
    </div>
  );
}
