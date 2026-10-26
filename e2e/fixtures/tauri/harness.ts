import type { FinishedPracticeSession, LearningMemoryView } from '@/core/ipc';
import type { PracticeDialogue } from '@/core/ipc/bindings/PracticeDialogue';
import type { PracticeMode } from '@/core/ipc/bindings/PracticeMode';
import type { PracticeSession } from '@/core/ipc/bindings/PracticeSession';
import type { AudioEdgeCounts } from './speech';

export type PracticeOptions = {
  topic_id: string;
  topic_custom: string | null;
  duration_goal_seconds: number;
  practice_mode: PracticeMode;
};

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
