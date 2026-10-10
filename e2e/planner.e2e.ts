import { expect, type Page, test } from '@playwright/test';
import { initialSession } from './fixtureData';
import { harnessState } from './harnessTypes';
import type { PlannerFixtureOptions } from './plannerFixture';
import { installStreamingFixture } from './streamingFixture';
import { installTauriFixture } from './tauriFixture';

async function begin(page: Page, planner: PlannerFixtureOptions = {}, warmMicrophone = true) {
  await installTauriFixture(page, { activeSession: initialSession, planner });
  if (warmMicrophone) await installStreamingFixture(page, { warmMicrophone: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
async function send(page: Page) {
  await page.getByRole('button', { name: 'Type instead', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your answer to Eva' }).fill('I use a notebook to plan.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}
const edge = (page: Page) => page.evaluate(() => window.__ET_PLANNER__);
const example = 'One tool I use is a notebook. It helps me keep my ideas together.';
const newExample =
  'I chose a calendar because it saves time. For example, it reminds me about meetings.';

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('prefetch stays hidden and opens graduated cached help without another provider request', async ({
  page,
}) => {
  await begin(page);
  await expect.poll(async () => (await edge(page)).completed).toBe(1);
  expect((await edge(page)).cueWrites).toBe(0);
  await expect(page.getByText(example, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await expect(page.getByText('Name the tool', { exact: true })).toBeVisible();
  await expect(page.getByText('One tool I use is', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Phrases', exact: true }).click();
  await expect(page.getByText('One tool I use is', { exact: true })).toBeVisible();
  await expect(page.getByText(example, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Example', exact: true }).click();
  await expect(page.getByText(example, { exact: true })).toBeVisible();
  expect((await edge(page)).requested).toBe(1);
  await page.getByRole('button', { name: 'Hide before speaking', exact: true }).click();
  await expect(page.getByText(example, { exact: true })).toHaveCount(0);
  await send(page);
  await expect.poll(async () => (await harnessState(page)).dialogue?.help_used).toEqual([true]);
});

test('a failed plan can be retried while the answer composer stays usable', async ({ page }) => {
  await begin(page, { failFirstPlan: true });
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await expect(
    page.getByText('Help is temporarily unavailable. Retry later or keep speaking.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start speaking', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry help', exact: true }).click();
  await expect(page.getByText('Name the tool', { exact: true })).toBeVisible();
  expect((await edge(page)).requested).toBe(2);
  expect(
    (await harnessState(page)).calls
      .filter((call) => call.command === 'prefetch_answer_plan')
      .slice(-1)[0]?.args.retry,
  ).toBe(true);
});

test('help is not exposed until its cue write succeeds', async ({ page }) => {
  await begin(page, { failFirstCue: true });
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await expect(page.getByText('Name the tool', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Help could not be marked/)).toBeVisible();
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await expect(page.getByText('Name the tool', { exact: true })).toBeVisible();
  expect((await edge(page)).cueWrites).toBe(2);
});

test('a late plan for the previous question cannot replace the current example', async ({
  page,
}) => {
  await begin(page, { firstPlanDelayMs: 1500 });
  await send(page);
  await expect.poll(async () => (await edge(page)).requested).toBe(2);
  await page.getByRole('button', { name: 'Example', exact: true }).click();
  await expect(page.getByText(newExample, { exact: true })).toBeVisible();
  await expect.poll(async () => (await edge(page)).completed).toBe(2);
  await expect(page.getByText(example, { exact: true })).toHaveCount(0);
  await expect(page.getByText(newExample, { exact: true })).toBeVisible();
  expect((await harnessState(page)).dialogue?.help_used).toEqual([false]);
});

test('planning timers end quietly and manual recording cancels them', async ({ page }) => {
  await begin(page, {}, true);
  await page.clock.install();
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await page.getByRole('button', { name: '15 seconds', exact: true }).click();
  await expect(page.getByText('Planning time: 15s', { exact: true })).toBeVisible();
  await page.clock.fastForward(15000);
  await expect(page.getByRole('button', { name: 'Cancel planning', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Listening/u })).toHaveCount(0);
  await page.getByRole('button', { name: '30 seconds', exact: true }).click();
  await page.getByRole('button', { name: 'Start speaking', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel planning', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Listening/u })).toBeVisible();
});

test('a planning timer suppresses automatic capture after Eva finishes speaking', async ({
  page,
}) => {
  await installTauriFixture(page, { activeSession: initialSession });
  await installStreamingFixture(page, { warmMicrophone: true, holdVoice: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Listen after Eva speaks', { exact: true }).click();
  await send(page);
  await expect.poll(() => page.evaluate(() => window.__ET_STREAM__.providerFinished)).toBe(true);
  await page.getByRole('button', { name: 'Frame', exact: true }).click();
  await page.getByRole('button', { name: '15 seconds', exact: true }).click();
  await page.evaluate(() => window.__ET_STREAM__.finishSpeech());
  await expect.poll(() => page.evaluate(() => window.__ET_STREAM__.spoken.length)).toBe(2);
  await page.evaluate(() => window.__ET_STREAM__.finishSpeech());
  await expect(page.getByText('Planning time: 15s', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Listening/u })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start speaking', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Listening/u })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel planning', exact: true })).toHaveCount(0);
});

for (const firstCueDelayMs of [0, 800]) {
  test(`automatic capture hides Example even with a ${firstCueDelayMs}ms cue acknowledgment`, async ({
    page,
  }) => {
    await installTauriFixture(page, {
      activeSession: initialSession,
      planner: { firstCueDelayMs },
    });
    await installStreamingFixture(page, { warmMicrophone: true, holdVoice: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByText('Listen after Eva speaks', { exact: true }).click();
    await send(page);
    await expect.poll(() => page.evaluate(() => window.__ET_STREAM__.providerFinished)).toBe(true);
    await page.getByRole('button', { name: 'Example', exact: true }).click();
    if (firstCueDelayMs === 0)
      await expect(page.getByText(newExample, { exact: true })).toBeVisible();
    await page.evaluate(() => window.__ET_STREAM__.finishSpeech());
    await expect.poll(() => page.evaluate(() => window.__ET_STREAM__.spoken.length)).toBe(2);
    await page.evaluate(() => window.__ET_STREAM__.finishSpeech());
    await expect(page.getByRole('heading', { name: /^Listening/u })).toBeVisible();
    await expect.poll(async () => (await edge(page)).cueAcknowledged).toBe(1);
    await expect(page.getByText(newExample, { exact: true })).toHaveCount(0);
  });
}
