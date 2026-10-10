import { expect, type Page, test } from '@playwright/test';
import { initialSession } from './fixtureData';
import { harnessState } from './harnessTypes';
import { installStreamingFixture } from './streamingFixture';
import { installTauriFixture } from './tauriFixture';

async function begin(
  page: Page,
  options: {
    holdVoice?: boolean;
    noDeltas?: boolean;
    autoListen?: boolean;
    warmMicrophone?: boolean;
    voiceError?: boolean;
    cancelDelayMs?: number;
    holdProvider?: boolean;
  } = {},
) {
  await installTauriFixture(page, { activeSession: initialSession });
  await installStreamingFixture(page, options);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  if (options.autoListen) {
    await page.getByText('Listen after Eva speaks', { exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Listen after Eva speaks' })).toBeChecked();
  }
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page
    .getByRole('textbox', { name: 'Your answer to Eva' })
    .fill('A useful tool helps me plan.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}
const spoken = (page: Page) => page.evaluate(() => window.__ET_STREAM__.spoken);

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('the first sentence speaks before provider completion and the question is spoken once', async ({
  page,
}) => {
  await begin(page, { holdProvider: true });
  await expect.poll(() => spoken(page)).toEqual(['That sounds useful.']);
  expect(await page.evaluate(() => window.__ET_STREAM__.providerFinished)).toBe(false);
  await page.evaluate(() => window.__ET_STREAM__.finishProvider());
  await expect.poll(() => spoken(page)).toEqual(['That sounds useful.', 'How did you choose it?']);
  await expect.poll(() => page.evaluate(() => window.__ET_STREAM__.providerFinished)).toBe(true);
  const times = await page.evaluate(() => ({
    first: window.__ET_STREAM__.firstSpeechAtMs,
    complete: window.__ET_STREAM__.providerFinishedAtMs,
  }));
  expect(times.first).not.toBeNull();
  expect(times.complete).not.toBeNull();
  if (times.first === null || times.complete === null)
    throw new Error('Missing measured speech edges.');
  expect(times.complete - times.first).toBeGreaterThan(0);
  await page.getByLabel('Speech pipeline timing', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Speech pipeline timing' })).toContainText(
    'Send to first audio',
  );
});

test('an open stream gap does not auto-listen and completion fires only after the last utterance', async ({
  page,
}) => {
  await begin(page, {
    holdVoice: true,
    autoListen: true,
    warmMicrophone: true,
    holdProvider: true,
  });
  await expect.poll(() => spoken(page)).toHaveLength(1);
  await expect
    .poll(() => page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests))
    .toBeGreaterThan(0);
  const initialMedia = await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests);
  await page.evaluate(() => window.__ET_STREAM__.finishSpeech());
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests)).toBe(initialMedia);
  await page.evaluate(() => window.__ET_STREAM__.finishProvider());
  await expect.poll(() => spoken(page)).toHaveLength(2);
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests)).toBe(initialMedia);
  await page.evaluate(() => window.__ET_STREAM__.finishSpeech());
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests)).toBe(initialMedia);
});

test('a TTS failure keeps the saved reply visible and does not auto-listen', async ({ page }) => {
  await begin(page, { autoListen: true, voiceError: true, warmMicrophone: true });
  await expect(page.getByText('That sounds useful.', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Eva’s voice could not play. The reply stays on screen; try Hear it or continue speaking.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect.poll(async () => (await harnessState(page)).dialogue?.turns).toHaveLength(1);
  const mediaRequests = await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests);
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__.mediaRequests)).toBe(mediaRequests);
});

test('Escape cancels an in-flight reply and late chunks cannot revive speech or persist it', async ({
  page,
}) => {
  await begin(page, { holdVoice: true });
  await expect.poll(() => spoken(page)).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect
    .poll(
      async () =>
        (await harnessState(page)).calls.filter((call) => call.command === 'cancel_practice_reply')
          .length,
    )
    .toBe(1);
  await page.waitForTimeout(900);
  expect(await spoken(page)).toEqual(['That sounds useful.']);
  expect((await harnessState(page)).dialogue?.turns).toHaveLength(0);
  await page.evaluate(() => window.__ET_STREAM__.finishSpeech());
  expect(await spoken(page)).toHaveLength(1);
});

test('Speak anyway is enabled while Eva is thinking and interrupts before opening capture', async ({
  page,
}) => {
  await begin(page, { noDeltas: true });
  await page.getByRole('button', { name: 'Speak anyway', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await harnessState(page)).calls.filter((call) => call.command === 'cancel_practice_reply')
          .length,
    )
    .toBe(1);
  await page.waitForTimeout(900);
  expect(await spoken(page)).toEqual([]);
  expect((await harnessState(page)).dialogue?.turns).toHaveLength(0);
});

test('a provider without deltas speaks the final reply once', async ({ page }) => {
  await begin(page, { noDeltas: true });
  await expect.poll(() => spoken(page)).toEqual(['That sounds useful. How did you choose it?']);
});

test('releasing Space during reply cancellation abandons the delayed recording', async ({
  page,
}) => {
  await begin(page, { noDeltas: true, warmMicrophone: true, cancelDelayMs: 200 });
  await page.getByRole('heading', { name: 'Thinking', exact: true }).click();
  await page.keyboard.down(' ');
  await page.keyboard.up(' ');
  await expect
    .poll(
      async () =>
        (await harnessState(page)).calls.filter((call) => call.command === 'cancel_practice_reply')
          .length,
    )
    .toBe(1);
  await expect(page.getByRole('button', { name: 'Start speaking', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Listening…', exact: true })).toHaveCount(0);
  expect((await harnessState(page)).dialogue?.turns).toHaveLength(0);
  expect(await spoken(page)).toEqual([]);
});
