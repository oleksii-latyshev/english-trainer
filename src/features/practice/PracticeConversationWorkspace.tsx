import { Button } from '@heroui/react';
import type { ReactNode } from 'react';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { DailyRecallPanel } from './DailyRecallPanel';
import type { SessionDetails } from './lib/practiceState';
import type { SentAnswer } from './lib/sentAnswer';
import { PracticeControls } from './PracticeControls';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { TranscriptPanel } from './TranscriptPanel';
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
  followUpPanel: ReactNode;
  savedAnswer: SentAnswer | null;
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
  followUpPanel,
  savedAnswer,
  onNavigate,
}: Props) {
  const canUseRecall = session?.mode === 'conversation' && session.turnCount >= session.targetTurns;
  return (
    <section aria-label="Conversation workspace" hidden={activeScreen !== 'conversation'}>
      <div className="practice-header">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
            CONVERSATION GYM · SPONTANEOUS SPOKEN TURNS
          </span>
        </div>
        <h1 id="practice-title">Your voice, in English.</h1>
        <p className="intro">
          {session
            ? 'Answer Eva’s question aloud, then send your local transcript. Aim for a detailed answer each turn.'
            : 'Take a moment to answer the prompt. We’ll transcribe your words locally, then read them back so you can hear the phrasing.'}
        </p>
      </div>
      <div className="practice-grid mt-6">
        <div className="practice-main-col">
          <PracticeControls
            actions={actions}
            isRetrying={isRetrying}
            model={model}
            recallActive={recall.active}
            recallCompletedCount={
              recall.state.tag === 'ready' ? recall.state.plan.completed_count : 0
            }
            recallCue={recall.active ? recall.currentItem?.cue : undefined}
            recallLocked={recall.saving || recall.result !== null}
            retryPrompt={retryPrompt}
            surface="conversation"
          />
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
          <TranscriptPanel transcript={model.transcript} />
          {activeScreen === 'conversation' ? followUpPanel : null}
          {(savedAnswer || model.transcript) && (
            <div className="coach-gateway-banner">
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
                onPress={() => onNavigate?.('coach')}
              >
                Open Coach →
              </Button>
            </div>
          )}
          <TimingPanel timing={model.timing} />
        </div>
        <div className="practice-side-col">
          <SpeechPanel speech={speech} transcript={model.transcript} />
        </div>
      </div>
    </section>
  );
}
