import { useAtomValue } from '@effect/atom-react';
import {
  isReviewPhase,
  isSessionBusyAtom,
  practiceStageIsWriting,
  practiceStageUsesAudio,
  type SessionDetails,
} from '@/core/practice-session';
import {
  Composer,
  FlowMenu,
  LiveTranscript,
  TurnStage,
  useComposerEffects,
} from '@/features/talk-composer';
import { Dialogue } from '@/features/talk-dialogue';
import {
  NoSession,
  SessionHeader,
  useSessionClock,
  useSessionState,
} from '@/features/talk-session';
import { TalkNotices } from './components/talk-notices';
import type { TalkScreenProps } from './types';

type WorkspaceProps = TalkScreenProps & {
  session: SessionDetails;
  isFinishing: boolean;
};

function isSpokenReplay(session: SessionDetails): boolean {
  return session.practiceMode === 'write_then_speak' && session.practicePhase === 'speaking';
}

function Workspace({ session, isFinishing, ...props }: WorkspaceProps) {
  const isReplay = isSpokenReplay(session);
  const isWriting = practiceStageIsWriting(session);
  const isReplayComplete = isReplay && session.spokenTurnCount >= session.writtenTurnCount;
  return (
    <section
      aria-label="Talk workspace"
      className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto"
    >
      <SessionHeader
        isFinishBlocked={props.isFinishBlocked}
        isFinishing={isFinishing}
        session={session}
      >
        <FlowMenu />
      </SessionHeader>
      {isReplay && props.replayPrompt}
      <TurnStage isWriting={isWriting} mood={props.moodExtras} />
      <div className={`flex min-h-56 w-full flex-1 flex-col ${isWriting ? '' : '-mt-24'}`}>
        <Dialogue
          canReplay={practiceStageUsesAudio(session)}
          currentQuestion={isReplayComplete ? undefined : session.question}
          renderNote={props.renderNote}
        >
          <TalkNotices />
          <LiveTranscript />
          {props.dialogueExtras}
        </Dialogue>
      </div>
      <Composer
        helpSlot={props.helpBar}
        lockedReason={props.lockedReason}
        onChooseMicrophone={props.onChooseMicrophone}
        onOpenSettings={props.onOpenSettings}
        rescueSlot={props.rescueControl}
      />
    </section>
  );
}

function Content(props: TalkScreenProps) {
  const { state } = useSessionState();
  const isBusy = useAtomValue(isSessionBusyAtom);
  if (state.tag !== 'active' && state.tag !== 'waiting' && state.tag !== 'finishing') {
    return <NoSession isDisabled={isBusy} onStart={props.onStartPractice} />;
  }
  if (isReviewPhase(state)) return props.reviewStage;
  return <Workspace {...props} isFinishing={state.tag === 'finishing'} session={state} />;
}

export function TalkScreen(props: TalkScreenProps) {
  useSessionClock();
  useComposerEffects();
  return (
    <div className="talk-screen h-full min-h-0">
      <Content {...props} />
    </div>
  );
}
