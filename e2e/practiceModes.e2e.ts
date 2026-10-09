import { expect, test } from '@playwright/test';
import type { PracticeDialogue } from '../src/lib/dialogueTypes';
import type { PracticeSession } from '../src/lib/practiceSessionTypes';
import { initialSession } from './fixtureData';
import { harnessState } from './harnessTypes';
import { installTauriFixture } from './tauriFixture';

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('restored speaking review separates saved answers and preserves its summary stage', async ({
  page,
}) => {
  const session: PracticeSession = {
    ...initialSession,
    turn_count: 2,
    practice_mode: 'write_then_speak',
    practice_phase: 'speaking_review',
    written_turn_count: 1,
    spoken_turn_count: 1,
  };
  const dialogue: PracticeDialogue = {
    session_id: session.session_id,
    opening_question: session.opening_question,
    turns: [
      {
        learner: 'I use a small task board to plan my day.',
        assistant_reply: 'That sounds useful.',
        assistant_question: 'How did you choose it?',
      },
      {
        learner: 'I have used it for a year.',
        assistant_reply: 'That is a helpful routine.',
        assistant_question: 'What changed for you?',
      },
    ],
    input_sources: ['text', 'voice'],
    reply_times_ms: [250, 250],
    answer_durations_ms: [null, 1200],
    help_used: [false, false],
    coaching: [
      {
        state: 'ready',
        feedback: {
          focus_feedback: [
            {
              category: 'grammar',
              original: 'I use',
              improved: 'I have used',
              explanation: 'The present perfect connects this routine to now.',
            },
          ],
          b2_rewrite: 'I have used a small task board to plan my day.',
        },
      },
      { state: 'pending' },
    ],
  };
  await installTauriFixture(page, { activeSession: session, dialogue });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Review speaking' })).toBeVisible();
  const written = page.getByRole('region', { name: 'Written answers' });
  const spoken = page.getByRole('region', { name: 'Spoken answers' });
  const writtenCard = written.getByRole('article');
  await expect(writtenCard).toContainText('Written answer 1');
  await expect(writtenCard).toContainText('The present perfect connects this routine to now.');
  await expect(spoken.getByText('Spoken answer 1')).toBeVisible();
  await expect(spoken.getByText('Checking your answer…')).toBeVisible();
  await expect(written.getByText('I have used it for a year.')).toHaveCount(0);
  await expect(spoken.getByText('I have used a small task board to plan my day.')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nice session. Here’s what to keep.' }),
  ).toBeVisible();
  await expect(
    page.getByText('Work & technology · Write, then speak · Review speaking · 0 s'),
  ).toBeVisible();
  const finished = (await harnessState(page)).finished;
  expect(finished).toMatchObject({
    practice_mode: 'write_then_speak',
    practice_phase: 'speaking_review',
    turn_count: 2,
    written_turn_count: 1,
    spoken_turn_count: 1,
  });
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });
});

test('Text chat stays text-only through review and carries its mode and counts into the summary', async ({
  page,
}) => {
  await installTauriFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Text chat/ }).click();
  await page.getByRole('button', { name: 'Start text chat' }).click();
  await expect(page.getByRole('heading', { name: 'Write your answer' })).toBeVisible();
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });

  const answer = 'I use a small task board to plan my day.';
  await page.getByLabel('Your answer to Eva').fill(answer);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('That sounds useful.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review writing' })).toBeVisible();
  const afterTurn = await harnessState(page);
  expect(afterTurn.activeSession).toMatchObject({
    practice_mode: 'text_chat',
    practice_phase: 'writing',
    turn_count: 1,
    written_turn_count: 0,
    spoken_turn_count: 0,
  });
  expect(afterTurn.calls).toContainEqual(
    expect.objectContaining({
      command: 'send_practice_turn',
      args: expect.objectContaining({ inputSource: 'text', transcript: answer }),
    }),
  );
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });

  await page.getByRole('button', { name: 'Review writing' }).click();
  await expect(page.getByRole('heading', { name: 'Review writing' })).toBeVisible();
  await expect(page.getByText('Written answer 1')).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nice session. Here’s what to keep.' }),
  ).toBeVisible();
  await expect(
    page.getByText('Work & technology · Text chat · Review writing · 0 s'),
  ).toBeVisible();
  const finished = (await harnessState(page)).finished;
  expect(finished).toMatchObject({
    practice_mode: 'text_chat',
    practice_phase: 'writing_review',
    turn_count: 1,
    written_turn_count: 1,
    spoken_turn_count: 0,
  });
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });
});
