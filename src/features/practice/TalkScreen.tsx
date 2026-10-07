import { Button, Kbd } from '@heroui/react';
import { isTauri } from '@tauri-apps/api/core';
import { type ReactNode, useState } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { setConversationFlow } from '@/lib/conversationFlowPreferences';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { Composer } from './Composer';
import { Dialogue } from './Dialogue';
import { EvaStage } from './EvaStage';
import { HelpBar } from './HelpBar';
import type { HelpLevel } from './lib/helpLevels';
import type { InputSource } from './lib/inputSource';
import { pauseControl } from './lib/pauseControl';
import type { SessionDetails } from './lib/practiceState';
import type { SendFailure } from './lib/turnIssue';
import { evaMoodFor } from './lib/turnState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { recordAnswerHelpUsed } from './sessionApi';
import { TalkHeader } from './TalkHeader';
import { TurnNotice } from './TurnNotice';
import { useTalkKeyboard } from './useTalkKeyboard';
import { useTalkTurn } from './useTalkTurn';
import './talk.css';
import './talkCards.css';
import './talkComposer.css';
import './talkDialogue.css';
import './talkHelp.css';
import './talkStage.css';

export type TalkScreenName =
  | 'home'
  | 'practice'
  | 'coach'
  | 'memory'
  | 'summary'
  | 'settings'
  | 'settings-microphone';

type Props = {
  mode: 'conversation' | 'coach';
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  session: SessionDetails;
  dialogue: PracticeDialogue | null;
  historyError: string;
  retryHistory: () => void;
  pendingReply?: string;
  sendError?: SendFailure;
  /** The question the learner is answering now; help is prepared for it. */
  question: string;
  lock: { isLocked: boolean; reason?: string };
  isRetrying: boolean;
  isRecalling?: boolean;
  isContinuing?: boolean;
  isFinishDisabled: boolean;
  isPhraseSaved?: boolean;
  coachStep?: string;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onNavigate?: (screen: TalkScreenName) => void;
  /** Extra material after the messages: recall, coaching notes, retry comparison. */
  children?: ReactNode;
};

function helpAvailable(question: string, isRetrying: boolean, isRecalling: boolean): boolean {
  return question !== '' && !isRetrying && !isRecalling;
}

/** The Talk screen shared by Conversation and Coach: header, Eva's stage, dialogue and composer. */
export function TalkScreen(props: Props) {
  const { mode, model, actions, speech, session, question, lock, isRetrying } = props;
  const isRecalling = props.isRecalling ?? false;
  const { actualInput } = usePreferredMicrophone();
  const turn = useTalkTurn({
    model,
    actions,
    speech,
    sendError: props.sendError,
    isLocked: lock.isLocked,
    isRetrying,
    isRecalling,
    isContinuing: props.isContinuing ?? false,
    pendingReply: props.pendingReply,
    onSend: props.onSend,
    onOpenSettings: () => props.onNavigate?.('settings'),
    onChooseMicrophone: () => props.onNavigate?.('settings-microphone'),
  });
  const { state, presentation, composer, flow } = turn;

  // Help opens per question; a new question starts closed without an effect resetting it.
  const helpKey = `${session.sessionId}:${session.turnCount + 1}:${question}`;
  const [help, setHelp] = useState<{ key: string; level: HelpLevel | null }>({
    key: helpKey,
    level: null,
  });
  const helpLevel = help.key === helpKey ? help.level : null;
  function changeHelpLevel(level: HelpLevel | null) {
    setHelp({ key: helpKey, level });
    if (level === null || !isTauri()) return;
    // The mark only decorates the saved answer, so a failed write must not interrupt the answer.
    recordAnswerHelpUsed(session.sessionId, session.turnCount + 1).catch((cause: unknown) =>
      console.warn('Could not record that help was used for this answer.', cause),
    );
  }
  const mood = evaMoodFor(state, turn.flowSignals, {
    isPhraseSaved: props.isPhraseSaved ?? false,
    isHelpOpen: helpLevel !== null,
  });

  const pause = {
    ...pauseControl({
      micStatus: model.micStatus,
      isRecording: model.status === 'recording',
      isTranscribing: model.transcribing,
      isBusy: turn.isBusy,
      isLocked: lock.isLocked,
    }),
    onPause: actions.pauseMic,
    onResume: actions.resumeMic,
  };
  const isHelpAvailable = helpAvailable(question, isRetrying, isRecalling);
  useTalkKeyboard({
    state,
    canPressMic: turn.canPressMic,
    isHelpAvailable,
    helpLevel,
    onHelpLevelChange: changeHelpLevel,
    onStartRecording: composer.startRecording,
    onStopRecording: actions.stopRecording,
    onCancelRecording: actions.cancelRecording,
    onCancelCountdown: composer.cancelAutoSend,
    onHoldListening: actions.holdListening,
    onStopEva: speech.stop,
  });
  const fixes = state.tag === 'error' ? state.issue.fixes.map((fix) => turn.fixes[fix]) : [];

  return (
    <section
      aria-label={mode === 'coach' ? 'Coach workspace' : 'Conversation workspace'}
      className="talk"
    >
      <TalkHeader
        coachStep={props.coachStep}
        isFinishDisabled={props.isFinishDisabled}
        isFinishing={model.practice.tag === 'finishing'}
        mode={mode}
        mood={mood}
        onFinish={actions.finishPractice}
        pause={pause}
        targetTurns={session.targetTurns}
        timing={model.timing}
        turnCount={session.turnCount}
      />
      <div className="talk-body">
        <EvaStage
          flow={flow}
          inputLabel={actualInput?.label}
          isSendLocked={lock.isLocked}
          mood={mood}
          onFlowChange={setConversationFlow}
          presentation={presentation}
        />
        <div className="talk-main">
          <Dialogue
            currentQuestion={question}
            dialogue={props.dialogue}
            historyError={props.historyError}
            onPlaySpeech={speech.play}
            pendingReply={props.pendingReply}
            retryHistory={props.retryHistory}
          >
            {model.practiceError && <TurnNotice message={model.practiceError} />}
            {props.children}
          </Dialogue>
          <div className="talk-composer-zone">
            <div className="talk-composer-inner">
              {isHelpAvailable && (
                <HelpBar
                  disabled={
                    turn.isBusy ||
                    composer.isSending ||
                    model.status === 'recording' ||
                    model.transcribing ||
                    lock.isLocked
                  }
                  key={helpKey}
                  level={helpLevel}
                  onLevelChange={changeHelpLevel}
                  question={question}
                  sequence={session.turnCount + 1}
                  sessionId={session.sessionId}
                />
              )}
              <Composer
                draft={composer.draft}
                isBusy={turn.isBusy}
                isHandsFree={flow.handsFree}
                isLocked={lock.isLocked}
                isSending={composer.isSending}
                level={model.level}
                lockedReason={lock.reason}
                notice={
                  state.tag === 'error' && (
                    <TurnNotice message={state.issue.message}>
                      {fixes.map((fix, index) => (
                        <Button
                          key={fix.label}
                          onPress={fix.run}
                          size="sm"
                          variant={index === 0 ? 'secondary' : 'ghost'}
                        >
                          {fix.label}
                        </Button>
                      ))}
                    </TurnNotice>
                  )
                }
                onCancel={actions.cancelRecording}
                onChangeDraft={composer.changeDraft}
                onHold={actions.holdListening}
                onResume={actions.resumeMic}
                onSend={composer.sendDraft}
                onStart={composer.startRecording}
                onStop={actions.stopRecording}
                onStopEva={speech.stop}
                presentation={presentation}
                state={state}
              />
              <div className="talk-hints">
                <span>
                  <Kbd>Space</Kbd>
                  hold to talk
                </span>
                <span>
                  <Kbd>Esc</Kbd>
                  cancel / stop Eva
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
