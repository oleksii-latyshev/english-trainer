import type { Page } from '@playwright/test';
import type { LearningMemoryView } from '@/core/ipc';
import type { PracticeSession } from '@/core/ipc/bindings/PracticeSession';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { emptyDialogue, finishedSession, initialSession } from '../../data/sessions';
import { installTauriCommands } from './commands';
import type { HarnessState } from './harness';
import { installMistakePractice } from './mistake-practice';
import { installPlanner, type PlannerOptions } from './planner';
import { installSpeech } from './speech';
import { installTranslation, type TranslationOptions } from './translation';

export type BaseSeed = {
  activeSession: PracticeSession | null;
  dialogue: PracticeDialogue | undefined;
  failNextStart: boolean;
  failNextSend: boolean;
  failNextTransition: boolean;
  failNextMistakePractice: boolean;
  mistakePreparationDelayMs: number;
  learningMemory: LearningMemoryView;
  translation: TranslationOptions;
  planner: PlannerOptions;
};

export async function installBase(page: Page, options: BaseSeed): Promise<void> {
  await installSpeech(page);
  const harness: HarnessState = {
    calls: [],
    errors: [],
    activeSession: options.activeSession,
    firstSession: initialSession,
    firstDialogue: emptyDialogue(initialSession),
    dialogue: options.activeSession
      ? (options.dialogue ?? emptyDialogue(options.activeSession))
      : null,
    finished: null,
    finishedTemplate: finishedSession,
    failNextStart: options.failNextStart,
    failNextSend: options.failNextSend,
    failNextTransition: options.failNextTransition,
    lastOptions: null,
    failNextMistakePractice: options.failNextMistakePractice,
    mistakePreparationDelayMs: options.mistakePreparationDelayMs,
    learningMemory: options.learningMemory,
  };
  await page.addInitScript((seed: HarnessState) => {
    Object.defineProperty(window, '__ET_HARNESS__', { value: seed });
    window.localStorage.setItem(
      'english_trainer_first_run',
      JSON.stringify({ status: 'finished' }),
    );
    window.localStorage.setItem(
      'english_trainer_conversation_flow',
      JSON.stringify({
        autoListen: false,
        handsFree: false,
        endPauseMs: 1500,
        autoSendVoice: false,
        autoSendDelayMs: 2000,
      }),
    );
  }, harness);
  await installTauriCommands(page);
  await page.addInitScript(() => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = (command, args) =>
      command === 'prewarm_natural_voice' ? Promise.resolve(false) : invoke(command, args);
  });
  await installMistakePractice(page);
  await installTranslation(page, options.translation);
  await installPlanner(page, options.planner);
}
