import { Button, Kbd } from '@heroui/react';
import { TurnNotice } from '@/components/TurnNotice';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { Composer } from './Composer';
import { HelpBar } from './HelpBar';
import type { HelpLevel } from './lib/helpLevels';
import type { SessionDetails } from './lib/practiceState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import type { useTalkTurn } from './useTalkTurn';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  session: SessionDetails;
  turn: ReturnType<typeof useTalkTurn>;
  isAudioStage: boolean;
  isHelpAvailable: boolean;
  lock: { isLocked: boolean; reason?: string };
  helpKey: string;
  helpLevel: HelpLevel | null;
  onHelpLevelChange: (level: HelpLevel | null) => void;
  question: string;
};

export function TalkComposerPanel({
  model,
  actions,
  speech,
  session,
  turn,
  isAudioStage,
  isHelpAvailable,
  lock,
  helpKey,
  helpLevel,
  onHelpLevelChange,
  question,
}: Props) {
  const { composer, flow, state } = turn;
  const fixes = state.tag === 'error' ? state.issue.fixes.map((fix) => turn.fixes[fix]) : [];
  const isHelpDisabled =
    turn.isBusy ||
    composer.isSending ||
    model.status === 'recording' ||
    model.transcribing ||
    lock.isLocked;

  return (
    <div className="talk-composer-zone">
      <div className="talk-composer-inner">
        {isHelpAvailable && (
          <HelpBar
            disabled={isHelpDisabled}
            key={helpKey}
            level={helpLevel}
            onLevelChange={onHelpLevelChange}
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
          presentation={turn.presentation}
          state={state}
          interaction={
            session.practicePhase === 'writing'
              ? 'writing'
              : session.practiceMode === 'write_then_speak'
                ? 'spoken_rehearsal'
                : 'voice'
          }
        />
        {isAudioStage && (
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
        )}
      </div>
    </div>
  );
}
