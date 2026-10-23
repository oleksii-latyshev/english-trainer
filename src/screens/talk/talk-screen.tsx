import { useAtomValue } from '@effect/atom-react';
import {
  isReviewPhase,
  isSessionBusyAtom,
  practiceStageIsWriting,
  practiceStageUsesAudio,
  type SessionDetails,
} from '@/core/practice-session';
import { Composer, LiveTranscript, TurnStage, useComposerEffects } from '@/features/talk-composer';
import { Dialogue } from '@/features/talk-dialogue';
import {
  NoSession,
  SessionHeader,
  useSessionClock,
  useSessionState,
} from '@/features/talk-session';
import { GlassPanel } from '@/shared/ui/glass-panel';
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
  const isReplayComplete = isReplay && session.spokenTurnCount >= session.writtenTurnCount;
  return (
    <section
      aria-label="Talk workspace"
      className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3"
    >
      <SessionHeader
        isFinishBlocked={props.isFinishBlocked}
        isFinishing={isFinishing}
        session={session}
      />
      <div className="flex min-h-0 flex-1 flex-col items-center">
        <TurnStage isWriting={practiceStageIsWriting(session)} mood={props.moodExtras} />
        <GlassPanel className="-mt-6 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          {isReplay && props.replayPrompt}
          <Dialogue
            canReplay={practiceStageUsesAudio(session)}
            currentQuestion={isReplayComplete ? undefined : session.question}
            renderNote={props.renderNote}
          >
            <TalkNotices />
            <LiveTranscript />
            {props.dialogueExtras}
          </Dialogue>
        </GlassPanel>
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
