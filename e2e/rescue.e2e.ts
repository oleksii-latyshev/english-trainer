import { expect, type Page, test } from '@playwright/test';
import { initialSession } from './fixtureData';
import { harnessState } from './harnessTypes';
import { installRescueFixture, type RescueFixtureOptions } from './rescueFixture';
import { installStreamingFixture } from './streamingFixture';
import { installTauriFixture } from './tauriFixture';

async function begin(page: Page, options: RescueFixtureOptions = {}) {
  await installTauriFixture(page, { activeSession: initialSession });
  await installStreamingFixture(page, { warmMicrophone: true });
  await installRescueFixture(page, options);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

async function startRecording(page: Page) {
  await page.getByRole('button', { name: 'Start speaking', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop and review', exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      page
        .getByLabel('Microphone level')
        .evaluate((element) => (element instanceof HTMLMeterElement ? element.value : 0)),
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(350);
}

async function focusConversation(page: Page) {
  await page.getByText('What is one tool that makes your work easier?', { exact: true }).click();
}

const edge = (page: Page) => page.evaluate(() => window.__ET_RESCUE__);
const calls = (page: Page) => page.evaluate(() => window.__ET_HARNESS__.calls);

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('S opens next-step help and simpler help without ending the live answer', async ({ page }) => {
  await begin(page);
  await startRecording(page);
  await focusConversation(page);
  await page.keyboard.press('s');
  await expect(page.getByText('Need a little help?', { exact: true })).toBeVisible();
  await expect.poll(async () => (await edge(page)).completed).toBe(1);
  await expect(
    page.getByText('For example, it helps me remember small tasks.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Say it simpler', exact: true }).click();
  await expect(page.getByText('It keeps my ideas in one place.', { exact: true })).toBeVisible();
  expect((await edge(page)).requests.map((request) => request.kind)).toEqual([
    'next_step',
    'simpler',
  ]);
  expect((await edge(page)).snapshots).toBe(2);
  expect((await edge(page)).finalTranscriptions).toBe(0);
  expect((await calls(page)).filter((call) => call.command === 'send_practice_turn')).toHaveLength(
    0,
  );
  await expect(page.getByRole('button', { name: 'Stop and review', exact: true })).toBeEnabled();
});

test('Missing word suggestions can be selected without rewriting or sending the answer', async ({
  page,
}) => {
  await begin(page, { noSpeech: true });
  await startRecording(page);
  await page.getByRole('button', { name: 'Stuck' }).click();
  await expect(
    page.getByText('No speech was recognized. Keep speaking and try Stuck again.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Missing word', exact: true }).click();
  const description = page.getByRole('textbox', { name: 'Describe the word in English' });
  await description.focus();
  await page.keyboard.press('s');
  await expect(description).toHaveValue('s');
  expect((await edge(page)).requests).toHaveLength(0);
  await description.fill('A place where I keep notes and ideas');
  await page.getByRole('button', { name: 'Find a word', exact: true }).click();
  await expect(page.getByRole('button', { name: 'cache', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'buffer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'cache', exact: true }).click();
  await expect(page.getByRole('status').getByText('cache', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'buffer', exact: true })).toHaveCount(0);
  const requests = (await edge(page)).requests;
  const selectedRequest = requests[requests.length - 1];
  expect(selectedRequest).toMatchObject({
    kind: 'missing_word',
    description: 'A place where I keep notes and ideas',
    partial_transcript: '',
  });
  expect((await calls(page)).filter((call) => call.command === 'send_practice_turn')).toHaveLength(
    0,
  );
  expect((await edge(page)).finalTranscriptions).toBe(0);
  expect((await edge(page)).snapshots).toBe(1);
});

test('a typed provider error is shown and Retry preserves missing-word mode and description', async ({
  page,
}) => {
  await begin(page, { failKindOnce: 'missing_word' });
  await startRecording(page);
  await page.getByRole('button', { name: 'Stuck' }).click();
  await expect.poll(async () => (await edge(page)).completed).toBe(1);
  await page.getByRole('button', { name: 'Missing word', exact: true }).click();
  const description = 'A short message that reminds me what to do';
  await page.getByRole('textbox', { name: 'Describe the word in English' }).fill(description);
  await page.getByRole('button', { name: 'Find a word', exact: true }).click();
  await expect(
    page.getByText('Rescue help could not respond. Keep speaking and retry Stuck.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'cache', exact: true })).toBeVisible();
  const missingWordRequests = (await edge(page)).requests.filter(
    (request) => request.kind === 'missing_word',
  );
  expect(missingWordRequests).toHaveLength(2);
  expect(missingWordRequests.map((request) => request.description)).toEqual([
    description,
    description,
  ]);
});

test('a late response after cancel cannot appear in a new recording', async ({ page }) => {
  await begin(page, { delayFirstMs: 800 });
  await startRecording(page);
  await focusConversation(page);
  await page.keyboard.press('s');
  await expect.poll(async () => (await edge(page)).requests).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Start speaking', exact: true })).toBeEnabled();
  await startRecording(page);
  await expect(page.getByRole('button', { name: 'Stuck' })).toBeVisible();
  await expect.poll(async () => (await edge(page)).completed).toBe(1);
  await expect(page.getByRole('button', { name: 'Stuck' })).toBeVisible();
  await expect(
    page.getByText('For example, it helps me remember small tasks.', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Stuck' }).click();
  await expect(
    page.getByText('For example, it helps me remember small tasks.', { exact: true }),
  ).toBeVisible();
  expect((await edge(page)).requests).toHaveLength(2);
});

test('Stop remains usable during rescue loading and keeps the full final transcript', async ({
  page,
}) => {
  await begin(page, { delayMs: 700 });
  await startRecording(page);
  await page.getByRole('button', { name: 'Stuck' }).click();
  await expect.poll(async () => (await edge(page)).requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Stop and review', exact: true }).click();
  const answer = page.getByRole('textbox', { name: 'What we heard — edit if needed' });
  await expect(answer).toHaveValue('I use a notebook because it helps me plan.');
  expect((await edge(page)).snapshots).toBe(1);
  expect((await edge(page)).finalTranscriptions).toBe(1);
  expect((await calls(page)).filter((call) => call.command === 'send_practice_turn')).toHaveLength(
    0,
  );
});

test('Continue speaking releases only the rescue hold and preserves the learner hold', async ({
  page,
}) => {
  await begin(page, { handsFree: true });
  await startRecording(page);
  await page.getByRole('button', { name: 'Keep listening', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done thinking', exact: true })).toBeVisible();
  await focusConversation(page);
  await page.keyboard.press('s');
  await expect.poll(async () => (await edge(page)).completed).toBe(1);
  await page.getByRole('button', { name: 'Continue speaking', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done thinking', exact: true })).toBeVisible();
  await expect(
    page.getByRole('status').getByText('Listening, turn held open', { exact: true }),
  ).toBeVisible();
  expect((await edge(page)).finalTranscriptions).toBe(0);
});

test('rescue pauses silent auto-listen idle expiry and Continue speaking restarts the 20 second wait', async ({
  page,
}) => {
  await begin(page, { silentMicrophone: true });
  await page.getByText('Listen after Eva speaks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Listen after Eva speaks' })).toBeChecked();
  await page.getByRole('button', { name: 'Type instead', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your answer to Eva' }).fill('I use a notebook to plan.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stuck' }).click();
  await expect(
    page.getByText('For example, it helps me remember small tasks.', { exact: true }),
  ).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(21_000);
  await expect(page.getByRole('button', { name: 'Stop and review', exact: true })).toBeEnabled();
  await expect(page.getByText('Need a little help?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue speaking', exact: true }).click();
  await page.clock.fastForward(20_500);
  await expect(page.getByRole('button', { name: 'Start speaking', exact: true })).toBeEnabled();
  expect((await edge(page)).snapshots).toBe(1);
  expect((await calls(page)).filter((call) => call.command === 'send_practice_turn')).toHaveLength(
    1,
  );
});
