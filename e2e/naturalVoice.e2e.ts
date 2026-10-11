import { expect, type Page, test } from '@playwright/test';
import { initialSession } from './fixtureData';
import { harnessState } from './harnessTypes';
import { installNaturalVoiceFixture } from './naturalVoiceFixture';
import { installStreamingFixture } from './streamingFixture';
import { installTauriFixture } from './tauriFixture';

async function begin(
  page: Page,
  options: {
    delayMs?: number;
    fails?: boolean;
    mediaFails?: boolean;
    ready?: boolean;
    autoListen?: boolean;
  } = {},
) {
  await installTauriFixture(page, { activeSession: initialSession });
  await installStreamingFixture(page, { holdProvider: true, warmMicrophone: options.autoListen });
  await installNaturalVoiceFixture(page, options);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  if (options.autoListen) await page.getByText('Listen after Eva speaks', { exact: true }).click();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page
    .getByRole('textbox', { name: 'Your answer to Eva' })
    .fill('A useful tool helps me plan.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}
const edge = (page: Page) =>
  page.evaluate(() => ({ ...window.__ET_NATURAL__, finishAudio: undefined }));
test.afterEach(async ({ page }) => {
  expect((await harnessState(page)).errors).toEqual([]);
});

test('local audio starts before provider finish, prefetches the next sentence, and listens only at final audio end', async ({
  page,
}) => {
  await begin(page, { autoListen: true });
  await expect.poll(async () => (await edge(page)).played).toBe(1);
  expect(await page.evaluate(() => window.__ET_STREAM__.providerFinished)).toBe(false);
  await page.evaluate(() => window.__ET_STREAM__.finishProvider());
  await expect
    .poll(async () => (await edge(page)).requests.map((request) => request.text))
    .toEqual(['That sounds useful.', 'How did you choose it?']);
  expect((await edge(page)).played).toBe(1);
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__ET_NATURAL__.finishAudio());
  await expect.poll(async () => (await edge(page)).played).toBe(2);
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__ET_NATURAL__.finishAudio());
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__ET_STREAM__.spoken)).toEqual([]);
});

test('late generated audio is discarded after an interruption', async ({ page }) => {
  await begin(page, { delayMs: 350 });
  await expect.poll(async () => (await edge(page)).requests.length).toBe(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  expect((await edge(page)).played).toBe(0);
  expect(await page.evaluate(() => window.__ET_STREAM__.spoken)).toEqual([]);
});

for (const [name, options] of [
  ['missing local model', { ready: false }],
  ['generation error', { fails: true }],
  ['slow generation', { delayMs: 1200 }],
  ['media failure before playback', { mediaFails: true }],
] as const) {
  test(`${name} falls back to system speech without replaying the answer`, async ({ page }) => {
    await begin(page, options);
    await expect
      .poll(() => page.evaluate(() => window.__ET_STREAM__.spoken))
      .toEqual(['That sounds useful.']);
    await page.evaluate(() => window.__ET_STREAM__.finishProvider());
    await expect
      .poll(() => page.evaluate(() => window.__ET_STREAM__.spoken))
      .toEqual(['That sounds useful.', 'How did you choose it?']);
    expect((await edge(page)).played).toBe(0);
  });
}

test('voice and speed choices persist and the preview uses them', async ({ page }) => {
  await installTauriFixture(page);
  await installNaturalVoiceFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel("Eva's voice", { exact: true }).selectOption('natural:5');
  await page.getByRole('button', { name: '1.1×', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect.poll(async () => (await edge(page)).played).toBe(1);
  expect((await edge(page)).requests[0]).toMatchObject({ voice_id: 5, speed: 1.1 });
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel("Eva's voice", { exact: true })).toHaveValue('natural:5');
  await expect(page.getByRole('button', { name: '1.1×', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a transient generation failure rewarms in the background and later previews return to local speech', async ({
  page,
}) => {
  await installTauriFixture(page);
  await installNaturalVoiceFixture(page, { failsOnce: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect.poll(async () => (await edge(page)).prewarms).toBeGreaterThanOrEqual(2);
  await expect(page.getByLabel("Eva's voice", { exact: true })).toHaveValue('natural:0');
  await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeEnabled();
  expect((await edge(page)).played).toBe(0);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect.poll(async () => (await edge(page)).played).toBe(1);
});
