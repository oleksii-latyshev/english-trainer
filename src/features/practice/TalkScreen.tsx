import { isTauri } from '@tauri-apps/api/core';
import { type ReactNode, useRef, useState } from 'react';
import { usePreferredMicrophone } from '@/audio/devicePreference';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { setConversationFlow } from '@/lib/conversationFlowPreferences';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { AnswerNote, type NoteTools } from './AnswerNote';
import { Dialogue } from './Dialogue';
import { EvaStage } from './EvaStage';
import type { HelpLevel } from './lib/helpLevels';
import type { InputSource } from './lib/inputSource';
import { pauseControl } from './lib/pauseControl';
import {
  practiceKeepsMicrophoneWarm,
  practiceStageIsWriting,
  practiceStageUsesAudio,
} from './lib/practiceStage';
import { practiceStageAction } from './lib/practiceStageAction';
import type { SessionDetails } from './lib/practiceState';
import type { SendFailure } from './lib/turnIssue';
import { evaMoodFor } from './lib/turnState';
import { LiveTranscriptBubble } from './Messages';
import { OriginalQuestionPrompt } from './OriginalQuestionPrompt';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { recordAnswerHelpUsed } from './sessionApi';
import { TalkComposerPanel } from './TalkComposerPanel';
import { TalkHeader } from './TalkHeader';
import { TalkNotices } from './TalkNotices';
import { exampleCueWasInterrupted, useExampleCaptureGuard } from './useExampleCaptureGuard';
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
  | 'memory'
  | 'summary'
  | 'settings'
  | 'settings-microphone';

type Props = {
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
  isFinishDisabled: boolean;
  isPhraseSaved?: boolean;
  /** Everything the notes under the learner's answers need; absent before a session exists. */
  noteTools: NoteTools | null;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onNavigate?: (screen: TalkScreenName) => void;
  onPlanningChange?: (active: boolean) => void;
  /** Extra material after the messages: recall, coaching notes, retry comparison. */
  children?: ReactNode;
};

function helpAvailable(question: string, isRetrying: boolean, isRecalling: boolean): boolean {
  return question !== '' && !isRetrying && !isRecalling;
}

/** The Talk screen: header, Eva's stage, dialogue with coaching notes, and the composer. */
export function TalkScreen(props: Props) {
  const { model, actions, speech, session, question, lock, isRetrying } = props;
  const isRecalling = props.isRecalling ?? false;
  const { actualInput } = usePreferredMicrophone();
  const isWritingStage = practiceStageIsWriting(session);
  const isMistakePractice = session.isMistakePractice;
  const isAudioStage = practiceStageUsesAudio(session);
  const canRecordAnswer = practiceKeepsMicrophoneWarm(session);
  const isSpokenReplay =
    session.practiceMode === 'write_then_speak' && session.practicePhase === 'speaking';
  const isReplayComplete = isSpokenReplay && session.spokenTurnCount >= session.writtenTurnCount;
  const showLiveTranscript =
    isAudioStage && model.status === 'recording' && model.heardSpeech && Boolean(model.liveText);
  const turn = useTalkTurn({
    model,
    actions,
    speech,
    sendError: props.sendError,
    isLocked: lock.isLocked,
    isRetrying,
    isRecalling,
    pendingReply: props.pendingReply,
    onSend: props.onSend,
    onOpenSettings: () => props.onNavigate?.('settings'),
    onChooseMicrophone: () => props.onNavigate?.('settings-microphone'),
  });
  const { state, presentation, composer, flow } = turn;
  const isCapturing = model.status === 'recording';

  // Help opens per question; a new question starts closed without an effect resetting it.
  const helpKey = `${session.sessionId}:${session.practicePhase}:${session.turnCount + 1}:${question}`;
  const currentHelpKey = useRef(helpKey);
  currentHelpKey.current = helpKey;
  const helpRequest = useRef(0);
  const requestedHelp = useRef<HelpLevel | null>(null);
  const [help, setHelp] = useState<{ key: string; level: HelpLevel | null }>({
    key: helpKey,
    level: null,
  });
  const [helpNotice, setHelpNotice] = useState<{ key: string; text: string } | null>(null);
  const helpLevel = help.key === helpKey ? help.level : null;
  const { captureEpoch, isCapturingRef } = useExampleCaptureGuard({
    isCapturing,
    helpLevel,
    helpKey,
    helpRequest,
    requestedHelp,
    setHelp,
    stopSpeech: speech.stop,
  });
  function changeHelpLevel(level: HelpLevel | null) {
    if (level === 'example' && isCapturingRef.current) return;
    const request = ++helpRequest.current;
    const requestKey = helpKey;
    const requestCaptureEpoch = captureEpoch.current;
    const wasCapturingAtRequest = isCapturingRef.current;
    if (level === null) {
      requestedHelp.current = null;
      setHelp({ key: requestKey, level: null });
      return;
    }
    requestedHelp.current = level;
    setHelpNotice(null);
    if (!isTauri()) {
      requestedHelp.current = null;
      setHelp({ key: requestKey, level });
      return;
    }
    void recordAnswerHelpUsed(session.sessionId, session.turnCount + 1)
      .then(() => {
        if (helpRequest.current !== request || currentHelpKey.current !== requestKey) return;
        requestedHelp.current = null;
        if (
          level === 'example' &&
          exampleCueWasInterrupted(
            wasCapturingAtRequest,
            requestCaptureEpoch,
            captureEpoch.current,
            isCapturingRef.current,
          )
        ) {
          setHelp({ key: requestKey, level: null });
          return;
        }
        setHelp({ key: requestKey, level });
      })
      .catch(() => {
        if (helpRequest.current !== request || currentHelpKey.current !== requestKey) return;
        requestedHelp.current = null;
        setHelp({ key: requestKey, level: null });
        setHelpNotice({
          key: requestKey,
          text: 'Help could not be marked. Try opening it again, or keep speaking.',
        });
      });
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
  const isHelpAvailable =
    canRecordAnswer &&
    !isMistakePractice &&
    !isWritingStage &&
    helpAvailable(question, isRetrying, isRecalling);
  function startRecording() {
    if (helpLevel === 'example') {
      speech.stop();
      changeHelpLevel(null);
    } else if (requestedHelp.current === 'example') {
      helpRequest.current += 1;
      requestedHelp.current = null;
    }
    composer.startRecording();
  }
  useTalkKeyboard({
    state,
    canPressMic: isAudioStage && turn.canPressMic,
    isHelpAvailable,
    helpLevel,
    onHelpLevelChange: changeHelpLevel,
    onStartRecording: startRecording,
    onStopRecording: actions.stopRecording,
    onCancelRecording: actions.cancelRecording,
    onCancelCountdown: composer.cancelAutoSend,
    onHoldListening: actions.holdListening,
    onStopEva: speech.stop,
  });
  const stageAction = practiceStageAction({
    mode: session.practiceMode,
    phase: session.practicePhase,
    writtenCount: session.writtenTurnCount,
    spokenCount: session.spokenTurnCount,
    isDisabled: turn.isBusy || model.practice.tag !== 'active' || isRetrying,
    transition: actions.transitionPracticePhase,
  });

  return (
    <section aria-label="Talk workspace" className="talk">
      <TalkHeader
        isFinishDisabled={props.isFinishDisabled}
        isFinishing={model.practice.tag === 'finishing'}
        mood={mood}
        onFinish={actions.finishPractice}
        pause={pause}
        session={session}
        stageAction={stageAction}
        isAudioStage={canRecordAnswer}
        timing={model.timing}
      />
      <div className="talk-body">
        {isWritingStage ? (
          <aside aria-label="Writing practice" className="talk-writing-stage">
            <h2>Write your answer</h2>
            <p>Take your time. Eva’s replies will stay on screen.</p>
          </aside>
        ) : (
          <EvaStage
            audioLevel={model.audioLevel}
            flow={flow}
            inputLabel={actualInput?.label}
            isSendLocked={lock.isLocked}
            mood={mood}
            onFlowChange={setConversationFlow}
            presentation={presentation}
          />
        )}
        <div className="talk-main">
          {isSpokenReplay && (
            <OriginalQuestionPrompt
              isComplete={isReplayComplete}
              question={question}
              spokenTurnCount={session.spokenTurnCount}
              writtenTurnCount={session.writtenTurnCount}
            />
          )}
          <Dialogue
            currentQuestion={isReplayComplete ? undefined : question}
            dialogue={props.dialogue}
            historyError={props.historyError}
            onPlaySpeech={isAudioStage ? speech.play : undefined}
            pendingReply={props.pendingReply}
            renderNote={(message) =>
              props.noteTools &&
              message.sequence !== undefined &&
              message.coaching && (
                <AnswerNote
                  coaching={message.coaching}
                  sequence={message.sequence}
                  tools={props.noteTools}
                  transcript={message.text}
                />
              )
            }
            retryHistory={props.retryHistory}
          >
            <TalkNotices practiceError={model.practiceError} voiceError={model.voiceError} />
            {showLiveTranscript && <LiveTranscriptBubble text={model.liveText} />}
            {props.children}
          </Dialogue>
          <TalkComposerPanel
            actions={actions}
            helpKey={helpKey}
            helpLevel={helpLevel}
            isAudioStage={canRecordAnswer}
            isHelpAvailable={isHelpAvailable}
            lock={lock}
            model={model}
            onHelpLevelChange={changeHelpLevel}
            onPlanningChange={props.onPlanningChange}
            onStartRecording={startRecording}
            helpNotice={helpNotice?.key === helpKey ? helpNotice.text : undefined}
            question={question}
            session={session}
            speech={speech}
            turn={turn}
          />
        </div>
      </div>
    </section>
  );
}
