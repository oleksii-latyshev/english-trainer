import {
  practiceKeepsMicrophoneWarm,
  practiceStageIsWriting,
  type SessionDetails,
} from '@/core/practice-session';

export function lockReason(
  isRecalling: boolean,
  isRetrying: boolean,
  isStageLocked: boolean,
  isMistakePractice: boolean,
): string | undefined {
  if (isRecalling) return 'Spoken phrase recall is in progress above.';
  if (isRetrying) return 'Re-speaking in progress. Finish or cancel it in the review.';
  if (!isStageLocked) return undefined;
  return isMistakePractice
    ? 'Practice complete. Finish when you are ready.'
    : 'All original questions have been answered. Review this stage to continue.';
}

export function canHelp(session: SessionDetails, isOccupied: boolean): boolean {
  if (!practiceKeepsMicrophoneWarm(session)) return false;
  if (session.isMistakePractice || practiceStageIsWriting(session)) return false;
  return session.question !== '' && !isOccupied;
}

export function hasRescue(session: SessionDetails): boolean {
  if (session.isMistakePractice || session.practiceMode === 'text_chat') return false;
  return session.practiceMode !== 'write_then_speak' || session.practicePhase === 'speaking';
}

export function offersRecall(session: SessionDetails): boolean {
  if (session.isMistakePractice) return false;
  if (session.practiceMode !== 'voice' || session.practicePhase !== 'speaking') return false;
  return session.turnCount >= session.targetTurns;
}
