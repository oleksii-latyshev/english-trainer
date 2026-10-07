import { createContext, useContext } from 'react';
import type { MicrophoneController } from '@/audio/useMicrophoneSession';
import type { usePracticeSession } from '@/features/practice/usePracticeSession';
import type { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { SessionMode } from '@/lib/types';

export type TrainerContextValue = {
  speech: ReturnType<typeof useSystemSpeech>;
  capture: ReturnType<typeof useSpeechCapture>;
  mic: MicrophoneController;
  practice: ReturnType<typeof usePracticeSession>;
  startPractice: (mode?: SessionMode) => void;
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
