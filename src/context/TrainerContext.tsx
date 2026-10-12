import { createContext, useContext } from 'react';
import type { MicrophoneController } from '@/app/microphone';
import type { SpeechControls } from '@/core/speech';
import type { FirstRunGate } from '@/features/first-run/useFirstRunGate';
import type { DueCount } from '@/features/memory/useDuePhraseCount';
import type { usePracticeSession } from '@/features/practice/usePracticeSession';
import type { useSpeechCapture } from '@/app/speech-capture';
import type { PracticeOptions } from '@/lib/practiceOptions';

export type TrainerContextValue = {
  speech: SpeechControls;
  capture: ReturnType<typeof useSpeechCapture>;
  mic: MicrophoneController;
  practice: ReturnType<typeof usePracticeSession>;
  startPractice: (options?: PracticeOptions) => void;
  startMistakePractice: () => Promise<boolean>;
  startOrResumePractice: () => void;
  isSessionOpen: boolean;
  /** Phrases due for review; shown in the sidebar and on the Talk start screen. */
  due: DueCount;
  /** Whether this launch opens first run instead of Talk start. */
  firstRun: FirstRunGate;
};

const TrainerContext = createContext<TrainerContextValue | null>(null);

export const TrainerProvider = TrainerContext.Provider;

export function useTrainer(): TrainerContextValue {
  const context = useContext(TrainerContext);
  if (!context) {
    throw new Error('useTrainer must be used within a TrainerProvider');
  }
  return context;
}
