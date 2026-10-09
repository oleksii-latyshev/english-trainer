import type { Page } from '@playwright/test';
import { emptyDialogue, finishedSession, initialSession } from './fixtureData';
import type { FixtureOptions, HarnessState } from './harnessTypes';
import { installMistakePracticeFixture } from './mistakePracticeFixture';
import { installSpeechFixture } from './speechFixture';
import { installTauriCommands } from './tauriCommands';

export async function installTauriFixture(page: Page, options: FixtureOptions = {}): Promise<void> {
  await installSpeechFixture(page);
  const harness: HarnessState = {
    calls: [],
    errors: [],
    activeSession: options.activeSession ?? null,
    firstSession: initialSession,
    firstDialogue: emptyDialogue(initialSession),
    dialogue: options.activeSession
      ? (options.dialogue ?? emptyDialogue(options.activeSession))
      : null,
    finished: null,
    finishedTemplate: finishedSession,
    failNextStart: options.failNextStart ?? false,
    failNextSend: options.failNextSend ?? false,
    failNextTransition: options.failNextTransition ?? false,
    lastOptions: null,
    failNextMistakePractice: options.failNextMistakePractice ?? false,
    mistakePreparationDelayMs: options.mistakePreparationDelayMs ?? 0,
    learningMemory: options.learningMemory ?? { mistakes: [], phrase_cards: [], due_count: 0 },
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
  await installMistakePracticeFixture(page);
}
