import { createContext, useContext } from 'react';
import type { usePracticeSession } from '@/features/practice/usePracticeSession';
import type { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';

export type TrainerContextValue = {
  speech: ReturnType<typeof useSystemSpeech>;
  capture: ReturnType<typeof useSpeechCapture>;
  practice: ReturnType<typeof usePracticeSession>;
  startPractice: () => void;
  startOrResumePractice: () => void;
  isSessionOpen: boolean;
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
