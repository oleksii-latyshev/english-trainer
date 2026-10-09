import { expect, test } from '@playwright/test';
import type { PracticeDialogue } from '../src/lib/dialogueTypes';
import type { PracticeSession } from '../src/lib/practiceSessionTypes';
import { initialSession } from './fixtureData';
import { harnessState } from './harnessTypes';
import { mistakeMemory, repeatedMistake } from './mistakePracticeData';
import { installTauriFixture } from './tauriFixture';

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('usual mistake practice needs a repeated non-archived mistake', async ({ page }) => {
  await installTauriFixture(page, {
    learningMemory: {
      ...mistakeMemory,
      mistakes: [
        { ...repeatedMistake, times_seen: 1 },
        { ...repeatedMistake, id: 18, status: 'archived' },
      ],
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Practice my usual mistakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeDisabled();
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'start_mistake_practice'),
  ).toEqual([]);
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });
});

test('a repeated mistake can start voice practice even when no items are due', async ({ page }) => {
  await installTauriFixture(page, {
    learningMemory: mistakeMemory,
    mistakePreparationDelayMs: 750,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByText('Preparing five questions…')).toBeVisible();
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });
  await expect(page.getByText('What did you enjoy about your time studying?')).toBeVisible();
  await expect(page.getByText(/Question 1 of 5/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Type instead' })).toHaveCount(0);
  expect((await harnessState(page)).activeSession).toMatchObject({
    is_mistake_practice: true,
    target_turns: 5,
  });
});

test('failed question preparation keeps Memory available for retry', async ({ page }) => {
  await installTauriFixture(page, { learningMemory: mistakeMemory, failNextMistakePractice: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Question preparation is unavailable');
  expect((await harnessState(page)).activeSession).toBeNull();
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByText(/Question 1 of 5/)).toBeVisible();
});

test('an existing conversation blocks a new mistake practice', async ({ page }) => {
  await installTauriFixture(page, { learningMemory: mistakeMemory, activeSession: initialSession });
  await page.goto('/');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeDisabled();
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'start_mistake_practice'),
  ).toEqual([]);
});

function savedPractice(answered: number): {
  activeSession: PracticeSession;
  dialogue: PracticeDialogue;
} {
  const activeSession: PracticeSession = {
    ...initialSession,
    opening_question:
      answered === 5
        ? 'Practice complete. Review your answers.'
        : 'What did you learn from your classmates?',
    target_turns: 5,
    turn_count: answered,
    topic_id: 'free_conversation',
    topic_label: 'Usual mistakes',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
    practice_phase: 'speaking',
    written_turn_count: 0,
    spoken_turn_count: answered,
    is_mistake_practice: true,
  };
  const dialogue: PracticeDialogue = {
    session_id: activeSession.session_id,
    opening_question: 'What did you enjoy about your time studying?',
    turns: Array.from({ length: answered }, (_, index) => ({
      learner: `I learned a useful skill at university ${index + 1}.`,
      assistant_reply: 'Thanks for sharing that.',
      assistant_question:
        index === answered - 1
          ? answered === 5
            ? ''
            : activeSession.opening_question
          : `What helped you learn skill ${index + 2}?`,
    })),
    input_sources: Array.from({ length: answered }, () => 'voice'),
    coaching: Array.from({ length: answered }, () => ({ state: 'pending' })),
  };
  return { activeSession, dialogue };
}

test('unfinished mistake practice restores the next question and progress', async ({ page }) => {
  await installTauriFixture(page, savedPractice(2));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(/Question 3 of 5/)).toBeVisible();
  await expect(page.getByText('What did you learn from your classmates?')).toBeVisible();
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'start_mistake_practice'),
  ).toEqual([]);
});

test('completed mistake questions lock another answer and finish with pending coaching', async ({
  page,
}) => {
  await installTauriFixture(page, savedPractice(5));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Practice complete', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests)).toBe(0);
  await page.locator('body').press('Space');
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'send_practice_turn'),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Nice session. Here’s what to keep.' }),
  ).toBeVisible();
  expect((await harnessState(page)).finished).toMatchObject({
    is_mistake_practice: true,
    turn_count: 5,
    target_turns: 5,
    pending_coaching: 1,
  });
});
