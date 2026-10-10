import type { Page } from '@playwright/test';
import type { PracticeDialogue } from '../src/lib/dialogueTypes';
import type { FinishedPracticeSession } from '../src/lib/finishedPracticeSession';
import type { LearningMemoryView } from '../src/lib/learningTypes';
import type { PracticeOptions } from '../src/lib/practiceOptions';
import type { PracticeSession } from '../src/lib/practiceSessionTypes';
import type { PlannerFixtureOptions } from './plannerFixture';
import type { AudioEdgeCounts } from './speechFixture';
import type { TranslationFixtureOptions } from './translationFixture';

export type FixtureOptions = {
  activeSession?: PracticeSession | null;
  dialogue?: PracticeDialogue;
  failNextStart?: boolean;
  failNextSend?: boolean;
  failNextTransition?: boolean;
  failNextMistakePractice?: boolean;
  mistakePreparationDelayMs?: number;
  learningMemory?: LearningMemoryView;
  translation?: TranslationFixtureOptions;
  planner?: PlannerFixtureOptions;
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

export async function harnessState(page: Page): Promise<HarnessState> {
  return page.evaluate(() => window.__ET_HARNESS__);
}
