import { expect, type Page, test } from '@playwright/test';
import { harnessState } from './harnessTypes';
import { installLiveReviewFixture } from './liveReviewFixture';

async function openAndRecord(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Memory/ }).click();
  await page
    .getByRole('region', { name: 'Spoken review', exact: true })
    .getByRole('button', { name: 'Review now' })
    .click();
  await page.getByRole('button', { name: 'Start speaking' }).click();
  await expect(page.getByRole('button', { name: 'Finish answer' })).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('opening Memory review prewarms a cold speech engine for the first live answer', async ({
  page,
}) => {
  await installLiveReviewFixture(page, { cold: true });
  await openAndRecord(page);
  await expect(page.getByRole('article', { name: 'Live transcript', exact: true })).toContainText(
    'A provisional suggestion',
  );
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.warmCalls)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted)).toEqual([]);
});

test('live review shows provisional words but saves only the final transcript, including shadowing', async ({
  page,
}) => {
  await installLiveReviewFixture(page);
  await openAndRecord(page);
  const bubble = page.getByRole('article', { name: 'Live transcript', exact: true });
  await expect(bubble).toContainText('A provisional suggestion');
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted)).toEqual([]);
  await page.getByRole('button', { name: 'Finish answer' }).click();
  await expect(page.getByText('Could we find a compromise?')).toBeVisible();
  await expect(bubble).toHaveCount(0);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted)).toEqual([
    'We can find a compromise.',
  ]);

  await page.getByRole('button', { name: 'Shadow it' }).click();
  await expect(bubble).toContainText('A provisional suggestion');
  await page.getByRole('button', { name: 'Finish answer' }).click();
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeVisible();
  await expect(bubble).toHaveCount(0);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted)).toHaveLength(1);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.finalCalls)).toBe(2);
});

for (const unavailable of [true, false]) {
  test(`final review answer survives ${unavailable ? 'unavailable' : 'failing'} live recognition`, async ({
    page,
  }) => {
    await installLiveReviewFixture(page, { unavailable, failPartial: !unavailable });
    await openAndRecord(page);
    if (unavailable) {
      await page.waitForTimeout(1800);
      expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls)).toBe(0);
    } else {
      await expect
        .poll(() => page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls))
        .toBeGreaterThan(0);
    }
    await expect(page.getByRole('article', { name: 'Live transcript', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Finish answer' }).click();
    await expect(page.getByText('Could we find a compromise?')).toBeVisible();
    expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted)).toEqual([
      'We can find a compromise.',
    ]);
  });
}

test('late partial after cancellation cannot enter a new recording or score an answer', async ({
  page,
}) => {
  await installLiveReviewFixture(page, { holdPartial: true });
  await openAndRecord(page);
  await expect.poll(() => page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Start speaking' })).toBeVisible();
  await page.getByRole('button', { name: 'Start speaking' }).click();
  await expect(page.getByRole('button', { name: 'Finish answer' })).toBeVisible();
  await page.evaluate(() => window.__ET_LIVE_REVIEW__.releasePartial());
  await expect(page.getByText('A late provisional suggestion')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Live transcript', exact: true })).toContainText(
    'A provisional suggestion',
  );
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted)).toEqual([]);
  await page.getByRole('button', { name: 'End review' }).click();
  const calls = await page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls);
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls)).toBe(calls);
});

test('a cancelled capture ignores late engine readiness and silent capture sends no partials', async ({
  page,
}) => {
  await installLiveReviewFixture(page, { holdStatus: true, silentAudio: true });
  await openAndRecord(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Start speaking' })).toBeVisible();
  await page.evaluate(() => window.__ET_LIVE_REVIEW__.releaseStatus());
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls)).toBe(0);
  await page.getByRole('button', { name: 'Start speaking' }).click();
  await expect(page.getByRole('button', { name: 'Finish answer' })).toBeVisible();
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls)).toBe(0);
  await page.getByRole('button', { name: 'Finish answer' }).click();
  await expect(page.getByText('Could we find a compromise?')).toBeVisible();
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.finalCalls)).toBe(1);
});

test('warmup can finish while a partial is pending and ignores it after the final answer', async ({
  page,
}) => {
  await installLiveReviewFixture(page, { holdPartial: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Before session' }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await page.getByRole('button', { name: 'Start speaking' }).click();
  await expect.poll(() => page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls)).toBe(1);
  // The ticker must not queue another local STT request while this one is pending.
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls)).toBe(1);
  await page.getByRole('button', { name: 'Finish answer' }).click();
  await expect(page.getByText('Could we find a compromise?')).toBeVisible();
  await page.evaluate(() => window.__ET_LIVE_REVIEW__.releasePartial());
  await expect(page.getByText('A late provisional suggestion')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Live transcript', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted)).toEqual([
    'We can find a compromise.',
  ]);
});
