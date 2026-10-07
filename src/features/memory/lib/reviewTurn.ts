import type { EvaMood } from '@/components/eva/Eva';
import type { MicVariant } from '@/components/MicControl';
import type { RecordingStatus } from '@/features/speech/captureView';
import type { LearningItemType } from '@/lib/learningTypes';

/** Where the learner is while one item waits for an answer. */
export type ReviewPhase = 'prompt' | 'starting' | 'listening' | 'transcribing' | 'saving';

export type ReviewSignals = {
  captureStatus: RecordingStatus;
  isTranscribing: boolean;
  /** The transcript is being saved and checked. */
  isSaving: boolean;
};

export function reviewPhase(signals: ReviewSignals): ReviewPhase {
  if (signals.isSaving) return 'saving';
  if (signals.captureStatus === 'requesting') return 'starting';
  if (signals.captureStatus === 'recording') return 'listening';
  if (signals.captureStatus === 'stopping' || signals.isTranscribing) return 'transcribing';
  return 'prompt';
}

export type ReviewMicCopy = {
  variant: MicVariant;
  icon: 'mic' | 'stop';
  /** Accessible name of the microphone control. */
  name: string;
  title: string;
  hint: string;
  isPressable: boolean;
};

function promptTitle(isEvaSpeaking: boolean, isPractice: boolean): string {
  if (isEvaSpeaking) return 'Eva is reading the situation';
  return isPractice ? 'Practice try — not scored' : 'Your answer';
}

/** What the microphone control says in each phase; Eva reading the situation only changes the prompt. */
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
        variant: 'quiet',
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
        variant: 'quiet',
        icon: 'mic',
        name: 'Transcribing',
        title: 'Transcribing…',
        hint: 'Turning your speech into text',
        isPressable: false,
      };
    case 'saving':
      return {
        variant: 'quiet',
        icon: 'mic',
        name: 'Checking your answer',
        title: 'Checking your answer…',
        hint: 'A moment',
        isPressable: false,
      };
  }
}

/** Eva while an item waits for an answer: she talks while reading the situation, then listens. */
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

/** Eva after the result: pleased when the phrase came up, encouraging when it did not. */
export function resultEvaMood(isUsed: boolean): EvaMood {
  return isUsed ? 'happy' : 'encouraging';
}

export type ReviewPrompt = {
  /** The small label above the text. */
  label: string;
  text: string;
  /** What Eva says aloud: a short lead-in, then the text. */
  spoken: string;
};

/**
 * The cue as Eva gives it. A phrase's cue is its note; a mistake's cue is the sentence as the
 * learner first said it, so Eva asks for it to be said better rather than reading it as a model.
 */
export function reviewPrompt(itemType: LearningItemType, cue: string): ReviewPrompt {
  if (itemType === 'mistake') {
    return {
      label: 'Eva · say it better',
      text: cue,
      spoken: `Say this one better. ${cue}`,
    };
  }
  return { label: 'Eva · situation', text: cue, spoken: `Here is a situation. ${cue}` };
}
