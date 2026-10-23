import type { PracticeMode, PracticePhase, SessionDetails } from '../../types';

export type InputSource = 'voice' | 'edited' | 'text';

export function phaseAllowsAudio(mode: PracticeMode, phase: PracticePhase): boolean {
  return phase === 'speaking' && (mode === 'voice' || mode === 'write_then_speak');
}

export function phaseAllowsText(mode: PracticeMode, phase: PracticePhase): boolean {
  return phase === 'writing' && (mode === 'text_chat' || mode === 'write_then_speak');
}

type Transition = {
  readonly mode: PracticeMode;
  readonly phase: PracticePhase;
  readonly next: PracticePhase;
  readonly writtenCount: number;
  readonly spokenCount: number;
};

export function canTransitionPracticePhase(transition: Transition): boolean {
  const { mode, phase, next, writtenCount, spokenCount } = transition;
  if (mode === 'text_chat') {
    return phase === 'writing' && next === 'writing_review' && writtenCount > 0;
  }
  if (mode !== 'write_then_speak') return false;
  if (phase === 'writing') return next === 'writing_review' && writtenCount > 0;
  if (phase === 'writing_review') return next === 'speaking';
  return phase === 'speaking' && next === 'speaking_review' && spokenCount === writtenCount;
}

export function canSendPracticeStage(session: SessionDetails): boolean {
  if (session.isMistakePractice) return session.turnCount < session.targetTurns;
  if (phaseAllowsText(session.practiceMode, session.practicePhase)) return true;
  if (session.practiceMode === 'voice') {
    return phaseAllowsAudio(session.practiceMode, session.practicePhase);
  }
  if (session.practicePhase === 'writing') return true;
  return session.practicePhase === 'speaking' && session.spokenTurnCount < session.writtenTurnCount;
}

export function canSendPracticeSource(session: SessionDetails, source: InputSource): boolean {
  if (!canSendPracticeStage(session)) return false;
  if (session.isMistakePractice) return source !== 'text';
  if (session.practiceMode === 'text_chat') return source === 'text';
  if (session.practiceMode === 'write_then_speak') {
    return session.practicePhase === 'writing' ? source === 'text' : source !== 'text';
  }
  return true;
}

export function practiceStageUsesAudio(session: SessionDetails): boolean {
  return phaseAllowsAudio(session.practiceMode, session.practicePhase);
}

export function practiceKeepsMicrophoneWarm(session: SessionDetails): boolean {
  return (
    practiceStageUsesAudio(session) &&
    (!session.isMistakePractice || session.turnCount < session.targetTurns)
  );
}

export function practiceStageIsWriting(session: SessionDetails): boolean {
  return phaseAllowsText(session.practiceMode, session.practicePhase);
}

export function isClockedStage(session: SessionDetails): boolean {
  if (session.practiceMode === 'voice') return true;
  if (session.practiceMode === 'text_chat') return session.practicePhase === 'writing';
  return session.practicePhase === 'writing' || session.practicePhase === 'speaking';
}

export function isSpokenStage(session: SessionDetails): boolean {
  return session.practiceMode === 'voice' || session.practicePhase === 'speaking';
}

export function isReviewPhase(session: SessionDetails): boolean {
  return session.practicePhase === 'writing_review' || session.practicePhase === 'speaking_review';
}
