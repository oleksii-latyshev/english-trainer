import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import { evaFoldedAtom } from '@/core/eva-look';
import {
  isReviewPhase,
  isSessionBusyAtom,
  practiceStageIsWriting,
  practiceStageUsesAudio,
  type SessionDetails,
  startPracticeAtom,
} from '@/core/practice-session';
import { useSpeech } from '@/core/speech';
import { useAnswerHelpEffects } from '@/features/answer-help';
import {
  Composer,
  FlowMenu,
  FoldEvaButton,
  FoldedEva,
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
import { OriginalQuestion } from '@/features/write-speak';
import { DialogueExtras } from './components/dialogue-extras';
import { ReviewStage } from './components/review-stage';
import { TalkNotices } from './components/talk-notices';
import { useComposerSlots } from './model/use-composer-slots';
import { type TalkGuards, useTalkGuards } from './model/use-talk-guards';
import type { TalkScreenProps } from './types';

type ContentProps = TalkScreenProps & { guards: TalkGuards };

type WorkspaceProps = ContentProps & {
  session: SessionDetails;
  isFinishing: boolean;
};

function isSpokenReplay(session: SessionDetails): boolean {
  return session.practiceMode === 'write_then_speak' && session.practicePhase === 'speaking';
}

function Workspace({ session, isFinishing, guards, ...props }: WorkspaceProps) {
  const slots = useComposerSlots(session, guards);
  const isReplay = isSpokenReplay(session);
  const isWriting = practiceStageIsWriting(session);
  const isEvaFolded = useAtomValue(evaFoldedAtom) && !isWriting;
  const isReplayComplete = isReplay && session.spokenTurnCount >= session.writtenTurnCount;
  return (
    <section
      aria-label="Talk workspace"
      className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto"
    >
      <SessionHeader
        isFinishBlocked={guards.isRecalling}
        isFinishing={isFinishing}
        leading={isEvaFolded && <FoldedEva />}
        session={session}
      >
        {!isWriting && !isEvaFolded && <FoldEvaButton />}
        <FlowMenu />
      </SessionHeader>
      {isReplay && (
        <OriginalQuestion
          isComplete={isReplayComplete}
          question={session.question}
          spokenTurnCount={session.spokenTurnCount}
          writtenTurnCount={session.writtenTurnCount}
        />
      )}
      <TurnStage isWriting={isWriting} mood={{ isHelpOpen: guards.isHelpOpen }} />
      <div
        className={`flex min-h-56 w-full flex-1 flex-col ${isWriting || isEvaFolded ? '' : '-mt-24'}`}
      >
        <Dialogue
          canReplay={practiceStageUsesAudio(session)}
          currentQuestion={isReplayComplete ? undefined : session.question}
          hasStageAbove={!isEvaFolded}
        >
          <TalkNotices />
          <LiveTranscript />
          <DialogueExtras guards={guards} session={session} />
        </Dialogue>
      </div>
      <Composer
        helpSlot={slots.helpBar}
        lockedReason={guards.lockedReason}
        onChooseMicrophone={props.onChooseMicrophone}
        onOpenSettings={props.onOpenSettings}
        rescueSlot={slots.rescueControl}
      />
    </section>
  );
}

function Content(props: ContentProps) {
  const registry = useContext(RegistryContext);
  const { state } = useSessionState();
  const isBusy = useAtomValue(isSessionBusyAtom);
  if (state.tag !== 'active' && state.tag !== 'waiting' && state.tag !== 'finishing') {
    return (
      <NoSession isDisabled={isBusy} onStart={() => registry.set(startPracticeAtom, undefined)} />
    );
  }
  if (isReviewPhase(state)) return <ReviewStage guards={props.guards} session={state} />;
  return <Workspace {...props} isFinishing={state.tag === 'finishing'} session={state} />;
}

export function TalkScreen(props: TalkScreenProps) {
  useSpeech();
  useSessionClock();
  useComposerEffects();
  useAnswerHelpEffects();
  const guards = useTalkGuards();
  return (
    <div className="h-full min-h-0">
      <Content {...props} guards={guards} />
    </div>
  );
}
