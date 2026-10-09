import type { Page } from '@playwright/test';
import type { PracticeSession } from '../src/lib/practiceSessionTypes';

/** The new command is faked at IPC; Talk and Memory still use their real components. */
export async function installMistakePracticeFixture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const internals = window.__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    internals.invoke = async (command, args = {}) => {
      const harness = window.__ET_HARNESS__;
      if (command === 'get_learning_memory' || command === 'view_learning_memory') {
        harness.calls.push({ command, args });
        return harness.learningMemory;
      }
      if (command === 'get_memory_review') {
        harness.calls.push({ command, args });
        return null;
      }
      if (command !== 'start_mistake_practice') return invoke(command, args);
      harness.calls.push({ command, args });
      if (harness.failNextMistakePractice) {
        harness.failNextMistakePractice = false;
        throw {
          code: 'rate_limited',
          message: 'Question preparation is unavailable. Please retry.',
        };
      }
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, harness.mistakePreparationDelayMs),
      );
      const session: PracticeSession = {
        ...harness.firstSession,
        opening_question: 'What did you enjoy about your time studying?',
        target_turns: 5,
        topic_id: 'free_conversation',
        topic_label: 'Usual mistakes',
        duration_goal_seconds: 300,
        practice_mode: 'voice',
        practice_phase: 'speaking',
        written_turn_count: 0,
        spoken_turn_count: 0,
        is_mistake_practice: true,
      };
      harness.activeSession = session;
      harness.dialogue = { ...harness.firstDialogue, opening_question: session.opening_question };
      return session;
    };
  });
}
