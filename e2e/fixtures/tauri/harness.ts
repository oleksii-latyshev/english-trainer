import type { PracticeDialogue } from '@/lib/dialogueTypes';
import type { FinishedPracticeSession } from '@/lib/finishedPracticeSession';
import type { LearningMemoryView } from '@/lib/learningTypes';
import type { PracticeOptions } from '@/lib/practiceOptions';
import type { PracticeSession } from '@/lib/practiceSessionTypes';
import type { AudioEdgeCounts } from './speech';

export type IpcCall = { command: string; args: Record<string, unknown> };

export type HarnessState = {
  calls: IpcCall[];
  errors: string[];
  activeSession: PracticeSession | null;
  firstSession: PracticeSession;
  firstDialogue: PracticeDialogue;
  finishedTemplate: FinishedPracticeSession;
  dialogue: PracticeDialogue | null;
  finished: FinishedPracticeSession | null;
  failNextStart: boolean;
  failNextSend: boolean;
  failNextTransition: boolean;
  failNextMistakePractice: boolean;
  mistakePreparationDelayMs: number;
  learningMemory: LearningMemoryView;
  lastOptions: PracticeOptions | null;
};

declare global {
  interface Window {
    __ET_HARNESS__: HarnessState;
    __TAURI_INTERNALS__: {
      invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
      transformCallback(callback: (payload: unknown) => void, once?: boolean): number;
      unregisterCallback(id: number): void;
    };
    isTauri: boolean;
    __ET_AUDIO_COUNTS__: AudioEdgeCounts;
  }
}
