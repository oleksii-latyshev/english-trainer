import { expect, type Page, test } from '@playwright/test';
import { harnessState } from './harnessTypes';
import { installReviewFixture } from './reviewFixture';

async function openReview(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Memory/ }).click();
  await page
    .getByRole('region', { name: 'Spoken review', exact: true })
    .getByRole('button', { name: 'Review now' })
    .click();
}

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('generated situation is used and Show phrase waits for persisted reveal', async ({ page }) => {
  await installReviewFixture(page);
  await openReview(page);
  await expect(
    page.getByText('Your team has two good ideas. Suggest how to agree on one.'),
  ).toBeVisible();
  await expect(page.getByText('Could we find a compromise?')).toHaveCount(0);

  await page.getByRole('button', { name: 'Show phrase' }).click();
  await expect(page.getByText('find a compromise', { exact: true })).toBeVisible();
  await expect(page.getByText('Practice with a hint — not independent use.')).toBeVisible();
  const review = await page.evaluate(() => window.__ET_REVIEW__);
  expect(review.calls).toContain('reveal_review_phrase');
  expect(review.materials.items[0].is_cued).toBe(true);
});

test('a preparation failure can be retried without blocking review controls', async ({ page }) => {
  await installReviewFixture(page, { failPreparationOnce: true });
  await openReview(page);
  await expect(page.getByText('The review service timed out. Try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry situations' }).click();
  await expect(
    page.getByText('Your team has two good ideas. Suggest how to agree on one.'),
  ).toBeVisible();
});

test('optional material IPC failure preserves retry and failed reveal shows no hint', async ({
  page,
}) => {
  await installReviewFixture(page, { throwPreparation: true, failReveal: true });
  await openReview(page);
  await expect(page.getByRole('button', { name: 'Retry situations' })).toBeEnabled();
  await expect(page.getByText('Agree on a solution.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Show phrase' }).click();
  await expect(page.getByText('Could not show the phrase. Please try again.')).toBeVisible();
  await expect(page.getByText('find a compromise', { exact: true })).toHaveCount(0);
  expect((await page.evaluate(() => window.__ET_REVIEW__.materials)).items[0].is_cued).toBe(false);
});

test('changing from warmup-first to Text chat starts without review or microphone', async ({
  page,
}) => {
  await installReviewFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Before session' }).click();
  await page.getByRole('button', { name: /^Text chat/ }).click();
  await expect(page.getByRole('button', { name: 'Before session' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start text chat', exact: true }).click();
  await expect(page.getByText('What is one tool that makes your work easier?')).toBeVisible();
  expect(await page.evaluate(() => window.__ET_REVIEW__.calls)).toEqual([]);
  expect((await harnessState(page)).lastOptions?.practice_mode).toBe('text_chat');
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests)).toBe(0);
});

test('late situations stay out of an active recording and Shadow it never scores twice', async ({
  page,
}) => {
  await installReviewFixture(page, { holdPreparation: true });
  await openReview(page);
  await expect(page.getByText('Agree on a solution.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start speaking' }).click();
  await expect(page.getByRole('button', { name: 'Finish answer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay', exact: true })).toBeDisabled();
  await expect
    .poll(() =>
      page
        .getByRole('meter', { name: 'Microphone level' })
        .evaluate((element) => (element instanceof HTMLMeterElement ? element.value : 0)),
    )
    .toBeGreaterThan(0);
  const speechCount = await page.evaluate(() => window.__ET_AUDIO_COUNTS__.speechRequests);
  await page.evaluate(() => window.__ET_REVIEW__.completePreparation());
  await expect(
    page.getByText('Your team has two good ideas. Suggest how to agree on one.'),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__.speechRequests)).toBe(speechCount);

  await page.getByRole('button', { name: 'Finish answer' }).click();
  await expect(page.getByText('Could we find a compromise?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show phrase' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Shadow it' }).click();
  await expect(page.getByRole('button', { name: 'Finish answer' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('meter', { name: 'Microphone level' })
        .evaluate((element) => (element instanceof HTMLMeterElement ? element.value : 0)),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Finish answer' }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  expect(
    (await page.evaluate(() => window.__ET_REVIEW__.calls)).filter(
      (call) => call === 'submit_memory_recall',
    ),
  ).toHaveLength(1);
});

test('warmup snapshots selected talk options and starts that conversation once on End', async ({
  page,
}) => {
  await installReviewFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();
  await page.getByRole('button', { name: 'Before session' }).click();
  await page.getByRole('button', { name: 'Free topic' }).click();
  await page.getByLabel('What would you like to talk about?').fill('A difficult team decision');
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await expect(page.getByRole('button', { name: 'Skip and start conversation' })).toBeVisible();

  await page.getByRole('button', { name: 'Skip and start conversation' }).click();
  await expect(page.getByText('What is one tool that makes your work easier?')).toBeVisible();
  const state = await harnessState(page);
  expect(state.lastOptions).toEqual({
    topic_id: 'free_topic',
    topic_custom: 'A difficult team decision',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
  });
  expect(state.calls.filter((call) => call.command === 'start_practice_session')).toHaveLength(1);
  expect(await page.evaluate(() => window.__ET_REVIEW__.calls)).toContain(
    'start_memory_review:true',
  );
});

test('a resumed scored warmup waits for its finish write before starting talk', async ({
  page,
}) => {
  await installReviewFixture(page, {
    completedRunWithDuePhrase: true,
    holdInitialFinish: true,
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();
  await page.getByRole('button', { name: 'Before session' }).click();
  await page.getByRole('button', { name: 'Free topic' }).click();
  await page.getByLabel('What would you like to talk about?').fill('A difficult team decision');
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__ET_REVIEW__.calls.filter((call) => call === 'finish_memory_review'),
      ),
    )
    .toHaveLength(1);
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'start_practice_session'),
  ).toHaveLength(0);
  await page.evaluate(() => window.__ET_REVIEW__.completeFinish(false));
  await expect(page.getByRole('button', { name: 'Retry finish' })).toBeVisible();
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'start_practice_session'),
  ).toHaveLength(0);

  await page.getByRole('button', { name: 'Retry finish' }).click();
  await expect(page.getByText('What is one tool that makes your work easier?')).toBeVisible();
  const state = await harnessState(page);
  expect(state.lastOptions).toEqual({
    topic_id: 'free_topic',
    topic_custom: 'A difficult team decision',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
  });
  expect(state.calls.filter((call) => call.command === 'start_practice_session')).toHaveLength(1);
  expect(
    (await page.evaluate(() => window.__ET_REVIEW__.calls)).filter(
      (call) => call === 'finish_memory_review',
    ),
  ).toHaveLength(2);
});

test('empty warmup can be skipped into the saved conversation options', async ({ page }) => {
  await installReviewFixture(page, { emptyWarmup: true });
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();
  await page.getByRole('button', { name: 'Before session' }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing to review right now' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip and start conversation' }).click();
  await expect(page.getByText('What is one tool that makes your work easier?')).toBeVisible();
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'start_practice_session'),
  ).toHaveLength(1);
});
