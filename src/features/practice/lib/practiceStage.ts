import { phaseAllowsAudio, phaseAllowsText } from '@/lib/practiceOptions';
import type { InputSource } from './inputSource';
import type { SessionDetails } from './practiceState';

/** A session may accept an answer only in an answer-taking phase. */
export function canSendPracticeStage(session: SessionDetails): boolean {
  if (phaseAllowsText(session.practiceMode, session.practicePhase)) return true;
  if (session.practiceMode === 'voice')
    return phaseAllowsAudio(session.practiceMode, session.practicePhase);
  if (session.practicePhase === 'writing') return true;
  return session.practicePhase === 'speaking' && session.spokenTurnCount < session.writtenTurnCount;
}

export function canSendPracticeSource(session: SessionDetails, source: InputSource): boolean {
  if (!canSendPracticeStage(session)) return false;
  if (session.practiceMode === 'text_chat') return source === 'text';
  if (session.practiceMode === 'write_then_speak') {
    return session.practicePhase === 'writing' ? source === 'text' : source !== 'text';
  }
  return true;
}

export function practiceStageUsesAudio(session: SessionDetails): boolean {
  return phaseAllowsAudio(session.practiceMode, session.practicePhase);
}

export function practiceStageIsWriting(session: SessionDetails): boolean {
  return phaseAllowsText(session.practiceMode, session.practicePhase);
}
