import { Button } from '@heroui/react';
import { MemoryUsageReview } from '@/features/memory/components/MemoryUsageReview';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { DailyRecallPanel } from './DailyRecallPanel';
import { DialogueStream } from './DialogueStream';
import type { InputSource } from './lib/inputSource';
import type { SessionDetails } from './lib/practiceState';
import type { SentAnswer } from './lib/sentAnswer';
import { PracticeChatComposer } from './PracticeChatComposer';
import { PracticeControls } from './PracticeControls';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import type { useDailyRecall } from './useDailyRecall';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  activeScreen: 'conversation' | 'coach';
  session?: SessionDetails;
  recall: ReturnType<typeof useDailyRecall>;
  isRetrying: boolean;
  retryPrompt?: string;
  sendError: string;
  historyError: string;
  retryHistory: () => void;
  savedAnswer: SentAnswer | null;
  dialogue: PracticeDialogue | null;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onNavigate?: (screen: 'home' | 'practice' | 'coach' | 'memory' | 'summary') => void;
};

export function PracticeConversationWorkspace({
  model,
  actions,
  speech,
  activeScreen,
  session,
  recall,
  isRetrying,
  retryPrompt,
  savedAnswer,
  dialogue,
  sendError,
  historyError,
  retryHistory,
  onSend,
  onNavigate,
}: Props) {
  const canUseRecall = session?.mode === 'conversation' && session.turnCount >= session.targetTurns;

  return (
    <section
      aria-label="Conversation workspace"
      className="practice-chat-layout"
      hidden={activeScreen !== 'conversation'}
    >
      <header className="practice-compact-header">
        <div className="practice-compact-header-left">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
            Conversation · Daily practice
          </span>
          <h1 className="practice-compact-title">
            {session ? session.question : 'Your voice, in English.'}
          </h1>
        </div>
        <div className="practice-compact-header-right">
          {session ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
                {session.turnCount} / {session.targetTurns} answers
              </span>
              <Button
                className="secondary-action text-xs"
                isDisabled={
                  model.busy ||
                  !model.canChangeSession ||
                  model.practice.tag !== 'active' ||
                  recall.active
                }
                onPress={actions.finishPractice}
                size="sm"
              >
                {model.practice.tag === 'finishing' ? 'Finishing…' : 'Finish'}
              </Button>
            </div>
          ) : (
            <Button
              className="primary-action text-xs"
              isDisabled={model.busy}
              onPress={() => actions.startPractice('conversation')}
              size="sm"
            >
              Start practice
            </Button>
          )}
        </div>
      </header>

      {model.practiceError && (
        <p className="error-message px-4 m-0" role="alert">
          {model.practiceError}
        </p>
      )}

      <DialogueStream
        currentQuestion={session?.question}
        dialogue={dialogue}
        historyError={historyError}
        retryHistory={retryHistory}
        onPlaySpeech={speech.play}
      >
        {canUseRecall && recall.active && (
          <div className="my-3">
            <PracticeControls
              actions={actions}
              isRetrying={isRetrying}
              model={model}
              recallActive={recall.active}
              recallCompletedCount={
                recall.state.tag === 'ready' ? recall.state.plan.completed_count : 0
              }
              recallCue={recall.currentItem?.cue}
              recallLocked={recall.saving || recall.result !== null}
              retryPrompt={retryPrompt}
              surface="conversation"
            />
          </div>
        )}

        {canUseRecall && (
          <DailyRecallPanel
            canLeave={model.canChangeSession}
            canStart={
              model.canChangeSession &&
              !model.busy &&
              !isRetrying &&
              model.practice.tag === 'active'
            }
            recall={{
              ...recall,
              start: () => {
                actions.resetCapture();
                recall.start();
              },
            }}
            resetCapture={actions.resetCapture}
            transcript={model.transcript}
          />
        )}

        {session?.mode === 'conversation' &&
          savedAnswer &&
          savedAnswer.sequence <= 2 &&
          dialogue?.input_sources?.[savedAnswer.sequence - 1] === 'voice' &&
          !isRetrying &&
          !recall.active && (
            <MemoryUsageReview sessionId={savedAnswer.sessionId} sequence={savedAnswer.sequence} />
          )}

        {(savedAnswer || model.transcript) && (
          <div className="coach-gateway-banner my-3">
            <div>
              <p className="section-kicker !text-purple-300">DELIBERATE PRACTICE</p>
              <p className="m-0 text-sm font-semibold text-zinc-100">
                {savedAnswer
                  ? 'Ready for focused feedback and Try Again on this answer?'
                  : 'Want focused feedback on this answer? Open Coach to review.'}
              </p>
              <p className="mt-1 mb-0 text-xs text-zinc-400">
                {savedAnswer
                  ? 'Review one high-value improvement, see a B2 rewrite, and re-speak your answer.'
                  : 'Send your answer to Eva to unlock focused feedback and re-speaking.'}
              </p>
            </div>
            <Button
              className="secondary-action shrink-0 !border-purple-500/30 hover:!bg-purple-500/20"
              isDisabled={model.busy || !model.canChangeSession || model.practice.tag !== 'active'}
              onPress={() => onNavigate?.('coach')}
            >
              Open Coach →
            </Button>
          </div>
        )}

        <details className="chat-collapsible-diagnostics my-3">
          <summary className="chat-collapsible-summary">Audio &amp; Voice Settings</summary>
          <div className="flex flex-col gap-4 p-4 border border-white/8 rounded-xl bg-black/30 mt-2">
            <SpeechPanel speech={speech} transcript={model.transcript} />
            <TimingPanel timing={model.timing} />
          </div>
        </details>
      </DialogueStream>

      <PracticeChatComposer
        busy={model.busy || model.practice.tag !== 'active'}
        currentRequestId={model.currentRequestId}
        disabled={session === undefined || recall.active || isRetrying}
        disabledReason={
          session === undefined
            ? 'Start a conversation above to begin.'
            : recall.active
              ? 'Spoken phrase recall in progress above.'
              : undefined
        }
        errorMessage={sendError || model.error || model.transcriptionFailure?.message}
        isRecording={model.status === 'recording'}
        isRetrying={isRetrying}
        onSend={onSend}
        onStartRecording={actions.startRecording}
        onStopRecording={actions.stopRecording}
        question={session?.question}
        recallActive={recall.active}
        sessionId={session?.sessionId}
        transcript={model.transcript}
        transcribing={model.transcribing}
      />
    </section>
  );
}
