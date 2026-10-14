import type { EvaMood } from '@/shared/ui/eva';

export type ReviewPhase = 'prompt' | 'starting' | 'listening' | 'transcribing' | 'saving';

export type CapturePhase = 'idle' | 'requesting' | 'recording' | 'stopping';

export type ReviewSignals = {
  readonly capture: CapturePhase;
  readonly isTranscribing: boolean;
  readonly isSaving: boolean;
};

export function reviewPhase(signals: ReviewSignals): ReviewPhase {
  if (signals.isSaving) return 'saving';
  if (signals.capture === 'requesting') return 'starting';
  if (signals.capture === 'recording') return 'listening';
  if (signals.capture === 'stopping' || signals.isTranscribing) return 'transcribing';
  return 'prompt';
}

export type ReviewMicCopy = {
  readonly variant: 'ready' | 'live' | 'busy';
  readonly icon: 'mic' | 'stop';
  readonly name: string;
  readonly title: string;
  readonly hint: string;
  readonly isPressable: boolean;
};

function promptTitle(isEvaSpeaking: boolean, isPractice: boolean): string {
  if (isEvaSpeaking) return 'Eva is reading the situation';
  return isPractice ? 'Practice try — not scored' : 'Your answer';
}

export function reviewMicCopy(
  phase: ReviewPhase,
  isEvaSpeaking: boolean,
  isPractice = false,
): ReviewMicCopy {
  switch (phase) {
    case 'prompt':
      return {
        variant: 'ready',
        icon: 'mic',
        name: 'Start speaking',
        title: promptTitle(isEvaSpeaking, isPractice),
        hint: isEvaSpeaking
          ? 'Press the mic to answer, or Esc to stop her'
          : 'Press the mic or hold Space',
        isPressable: true,
      };
    case 'starting':
      return {
        variant: 'busy',
        icon: 'mic',
        name: 'Starting the microphone',
        title: 'Starting the microphone…',
        hint: 'A moment',
        isPressable: false,
      };
    case 'listening':
      return {
        variant: 'live',
        icon: 'stop',
        name: 'Finish answer',
        title: 'Listening…',
        hint: 'Press to finish, or let go of Space. Esc cancels',
        isPressable: true,
      };
    case 'transcribing':
      return {
        variant: 'busy',
        icon: 'mic',
        name: 'Transcribing',
        title: 'Transcribing…',
        hint: 'Turning your speech into text',
        isPressable: false,
      };
    case 'saving':
      return {
        variant: 'busy',
        icon: 'mic',
        name: 'Checking your answer',
        title: 'Checking your answer…',
        hint: 'A moment',
        isPressable: false,
      };
  }
}

export function reviewEvaMood(phase: ReviewPhase, isEvaSpeaking: boolean): EvaMood {
  switch (phase) {
    case 'prompt':
      return isEvaSpeaking ? 'speaking' : 'idle';
    case 'starting':
    case 'listening':
      return 'listening';
    case 'transcribing':
    case 'saving':
      return 'processing';
  }
}

export function resultEvaMood(isUsed: boolean): EvaMood {
  return isUsed ? 'happy' : 'encouraging';
}

export function listeningOf(phase: ReviewPhase): 'no' | 'starting' | 'live' {
  if (phase === 'listening') return 'live';
  return phase === 'starting' ? 'starting' : 'no';
}
