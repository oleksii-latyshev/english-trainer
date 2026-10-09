import { expect, test } from '@playwright/test';
import { harnessState } from './harnessTypes';
import { installTauriFixture } from './tauriFixture';

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.title === 'an unconfigured IPC command rejects visibly in the fixture') return;
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('free topic needs a subject and start saves the selected topic and length', async ({
  page,
}) => {
  await installTauriFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();

  await page.getByRole('button', { name: 'Free topic' }).click();
  await expect(page.getByRole('button', { name: 'Start talking' })).toBeDisabled();
  await page.getByLabel('What would you like to talk about?').fill('A book I enjoyed');
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();

  await expect(page.getByText('What is one tool that makes your work easier?')).toBeVisible();
  const state = await harnessState(page);
  expect(state.lastOptions).toEqual({
    topic_id: 'free_topic',
    topic_custom: 'A book I enjoyed',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
  });
});

test('a start error can be retried without leaving the start screen', async ({ page }) => {
  await installTauriFixture(page, { failNextStart: true });
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();

  await page.getByRole('button', { name: 'Start talking' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not start practice');
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
});

test('an open session is offered as Continue and restores Talk', async ({ page }) => {
  await installTauriFixture(page, {
    activeSession: {
      session_id: 41,
      opening_question: 'What is one tool that makes your work easier?',
      turn_count: 0,
      target_turns: 8,
      retry_evidence: [],
      topic_id: 'work_technology',
      topic_label: 'Work & technology',
      topic_custom: null,
      duration_goal_seconds: 600,
      active_duration_ms: 0,
      started_at: 1_800_000_000_000,
      is_clock_running: false,
    },
  });
  await page.goto('/');

  await expect(page.getByRole('region', { name: 'Open conversation' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  await expect(page.getByText('What is one tool that makes your work easier?')).toBeVisible();
});

test('typed answers save as text and show the reply while coaching remains pending', async ({
  page,
}) => {
  await installTauriFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page.getByLabel('Your answer to Eva').fill('I use a small task board to plan my day.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText('That sounds useful.')).toBeVisible();
  await expect(page.getByText('Checking your answer…')).toBeVisible();
  const state = await harnessState(page);
  expect(state.calls).toContainEqual(
    expect.objectContaining({
      command: 'send_practice_turn',
      args: expect.objectContaining({
        inputSource: 'text',
        transcript: 'I use a small task board to plan my day.',
      }),
    }),
  );
});

test('a failed send keeps the draft available for retry', async ({ page }) => {
  await installTauriFixture(page, { failNextSend: true });
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await page.getByRole('button', { name: 'Type instead' }).click();
  const answer = 'I use a small task board to plan my day.';
  await page.getByLabel('Your answer to Eva').fill(answer);
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('could not be generated');
  await expect(page.getByLabel('Your answer to Eva')).toHaveValue(answer);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('That sounds useful.')).toBeVisible();
});

test('finishing shows the session topic and Talk more returns home', async ({ page }) => {
  await installTauriFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(
    page.getByRole('heading', { name: 'Nice session. Here’s what to keep.' }),
  ).toBeVisible();
  await expect(page.getByText('Work & technology · Speak · Speaking · 0 s')).toBeVisible();
  await page.getByRole('button', { name: 'Talk more' }).click();
  await expect(page.getByRole('heading', { name: 'What shall we talk about?' })).toBeVisible();
});

test('an unconfigured IPC command rejects visibly in the fixture', async ({ page }) => {
  await installTauriFixture(page);
  await page.goto('/');

  const message = await page.evaluate(async () => {
    try {
      await window.__TAURI_INTERNALS__.invoke('unexpected_command', {});
      return 'resolved';
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause);
    }
  });
  expect(message).toBe('Unhandled Tauri command in E2E fixture: unexpected_command');
  expect((await harnessState(page)).errors).toEqual([
    'Unhandled Tauri command in E2E fixture: unexpected_command',
  ]);
});

test('write then speak waits for Ready before opening audio and retries a failed phase change', async ({
  page,
}) => {
  await installTauriFixture(page, { failNextTransition: true });
  await page.goto('/');
  await page.getByRole('button', { name: /^Write, then speak/ }).click();
  await page.getByRole('button', { name: 'Start writing' }).click();
  await expect(page.getByRole('heading', { name: 'Write your answer' })).toBeVisible();

  const audioBeforeAnswer = await page.evaluate(() => window.__ET_AUDIO_COUNTS__);
  expect(audioBeforeAnswer).toEqual({ mediaRequests: 0, speechRequests: 0 });
  await page.locator('body').press('Space');
  await expect
    .poll(async () => page.evaluate(() => window.__ET_AUDIO_COUNTS__))
    .toEqual({
      mediaRequests: 0,
      speechRequests: 0,
    });

  await page.getByLabel('Your answer to Eva').fill('I use a small task board to plan my day.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('That sounds useful.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review writing' })).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => window.__ET_AUDIO_COUNTS__))
    .toEqual({
      mediaRequests: 0,
      speechRequests: 0,
    });
  expect((await harnessState(page)).activeSession?.written_turn_count).toBe(0);

  await page.getByRole('button', { name: 'Review writing' }).click();
  await expect(page.getByRole('heading', { name: 'Review writing' })).toBeVisible();
  await expect(page.getByText('Written answer 1')).toBeVisible();
  expect((await harnessState(page)).activeSession?.written_turn_count).toBe(1);
  await expect
    .poll(async () => page.evaluate(() => window.__ET_AUDIO_COUNTS__))
    .toEqual({
      mediaRequests: 0,
      speechRequests: 0,
    });

  await page.getByRole('button', { name: 'Ready to speak' }).click();
  await expect(page.getByRole('heading', { name: 'Review writing' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Could not move to the next practice stage');
  await expect
    .poll(async () => page.evaluate(() => window.__ET_AUDIO_COUNTS__))
    .toEqual({
      mediaRequests: 0,
      speechRequests: 0,
    });

  await page.getByRole('button', { name: 'Ready to speak' }).click();
  await expect(page.getByText('Original question 1 of 1')).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => window.__ET_AUDIO_COUNTS__.speechRequests))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests))
    .toBeGreaterThan(0);
  await expect(page.getByRole('status', { name: 'Microphone status' })).toContainText(
    'Not available right now.',
  );
  await expect(page.getByText('Original question 1 of 1')).toBeVisible();
  const state = await harnessState(page);
  expect(state.activeSession?.written_turn_count).toBe(1);
  expect(state.activeSession?.spoken_turn_count).toBe(0);
});
