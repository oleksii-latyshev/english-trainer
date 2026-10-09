import { expect, type Locator, type Page, test } from '@playwright/test';
import { harnessState } from './harnessTypes';
import { mistakeMemory } from './mistakePracticeData';
import { installTauriFixture } from './tauriFixture';
import { wordDialogue, wordSession } from './translationData';

async function selectText(locator: Locator, text: string): Promise<void> {
  await locator.evaluate((element, selectedText) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const offset = (node.textContent ?? '').indexOf(selectedText);
      if (offset >= 0) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + selectedText.length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        return;
      }
      node = walker.nextNode();
    }
    throw new Error('Selection text was not present.');
  }, text);
}
async function lookupCalls(page: Page) {
  return (await harnessState(page)).calls.filter((call) => call.command === 'translate_word');
}
async function openMemory(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByRole('tab', { name: 'Mistakes · 1' }).click();
  await expect(page.getByText('at university', { exact: true })).toBeVisible();
}
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Translate a word' });

test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await harnessState(page)).errors).toEqual([]);
});

test('Memory translates one selected word only after an explicit action', async ({ page }) => {
  await installTauriFixture(page, { learningMemory: mistakeMemory });
  await openMemory(page);
  await selectText(page.getByText('at university', { exact: true }), 'university');
  await expect(page.getByRole('button', { name: 'Translate “university”' })).toBeVisible();
  expect(await lookupCalls(page)).toEqual([]);
  await page.getByRole('button', { name: 'Translate “university”' }).click();
  await expect(dialog(page).getByText('Перевод: university')).toBeVisible();
  await expect(dialog(page).getByText('A simple English explanation of university.')).toBeVisible();
  const requests = await lookupCalls(page);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.args.request).toMatchObject({ word: 'university' });
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });
});

test('multiword and unmarked selections do not offer contextual translation', async ({ page }) => {
  await installTauriFixture(page, { learningMemory: mistakeMemory });
  await openMemory(page);
  await selectText(page.getByText('at university', { exact: true }), 'at university');
  await expect(page.getByRole('button', { name: /^Translate “/ })).toHaveCount(0);
  await selectText(page.getByRole('heading', { name: 'Practice my usual mistakes' }), 'Practice');
  await expect(page.getByRole('button', { name: /^Translate “/ })).toHaveCount(0);
  expect(await lookupCalls(page)).toEqual([]);
});

test('Talk and inline coaching share local word lookup without sending answers', async ({
  page,
}) => {
  await installTauriFixture(page, { activeSession: wordSession, dialogue: wordDialogue });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await selectText(page.getByText(wordSession.opening_question, { exact: true }), 'projects');
  await page.getByRole('button', { name: 'Translate “projects”' }).click();
  await expect(dialog(page).getByText('Перевод: projects')).toBeVisible();
  await page.getByRole('button', { name: 'Close translation' }).click();
  await expect(page.getByRole('button', { name: 'Collapse note' })).toBeVisible();
  await selectText(
    page.getByText('The present perfect connects your experience to now.', { exact: true }),
    'experience',
  );
  await page.getByRole('button', { name: 'Translate “experience”' }).click();
  await expect(dialog(page).getByText('Перевод: experience')).toBeVisible();
  expect(
    (await harnessState(page)).calls.filter((call) => call.command === 'send_practice_turn'),
  ).toEqual([]);
  expect(await page.evaluate(() => window.__ET_AUDIO_COUNTS__)).toEqual({
    mediaRequests: 0,
    speechRequests: 0,
  });
});

test('keyboard lookup rejects sentences and retries provider errors', async ({ page }) => {
  await installTauriFixture(page, {
    learningMemory: mistakeMemory,
    translation: { failNextTranslation: true },
  });
  await openMemory(page);
  await page.getByRole('button', { name: 'Translate a word', exact: true }).click();
  const input = dialog(page).getByRole('textbox', { name: 'English word' });
  await input.fill('two words');
  await input.press('Enter');
  await expect(dialog(page).getByRole('alert')).toContainText('one English word');
  expect(await lookupCalls(page)).toEqual([]);
  await input.fill('useful');
  await input.press('Enter');
  await expect(dialog(page).getByRole('alert')).toContainText('Translation could not finish');
  await dialog(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(dialog(page).getByText('Перевод: useful')).toBeVisible();
  await input.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('missing models are prepared only by an explicit action', async ({ page }) => {
  await installTauriFixture(page, {
    learningMemory: mistakeMemory,
    translation: { needsDownload: true },
  });
  await openMemory(page);
  await page.getByRole('button', { name: 'Translate a word', exact: true }).click();
  await dialog(page).getByRole('textbox', { name: 'English word' }).fill('useful');
  await dialog(page).getByRole('button', { name: 'Translate', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Prepare languages');
  expect(
    (await harnessState(page)).calls.filter(
      (call) => call.command === 'prepare_translation_languages',
    ),
  ).toEqual([]);
  await dialog(page).getByRole('button', { name: 'Prepare languages' }).click();
  await expect(
    dialog(page).getByText('Translation languages are ready on this Mac.'),
  ).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Translate', exact: true }).click();
  await expect(dialog(page).getByText('Перевод: useful')).toBeVisible();
});

test('closing a pending lookup prevents its late result from reopening the panel', async ({
  page,
}) => {
  await installTauriFixture(page, {
    learningMemory: mistakeMemory,
    translation: { delayedWord: 'useful' },
  });
  await openMemory(page);
  await page.getByRole('button', { name: 'Translate a word', exact: true }).click();
  await dialog(page).getByRole('textbox', { name: 'English word' }).fill('useful');
  await dialog(page).getByRole('button', { name: 'Translate', exact: true }).click();
  await expect(
    dialog(page).getByRole('status').filter({ hasText: 'Translating useful' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close translation' }).click();
  await expect.poll(() => page.evaluate(() => window.__ET_TRANSLATION_DONE__)).toBe(1);
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Translate a word', exact: true }).click();
  await expect(dialog(page).getByText('Перевод: useful')).toHaveCount(0);
});

test('native language changes persist and are used by later lookups', async ({ page }) => {
  await installTauriFixture(page, { learningMemory: mistakeMemory });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const nativeLanguage = page.getByRole('combobox', { name: 'Native language' });
  await expect(nativeLanguage).toHaveValue('ru');
  await nativeLanguage.selectOption('de');
  await expect(nativeLanguage).toHaveValue('de');
  await expect
    .poll(
      async () =>
        (await harnessState(page)).calls.filter(
          (call) => call.command === 'save_translation_settings',
        ).length,
    )
    .toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(nativeLanguage).toHaveValue('de');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByRole('button', { name: 'Translate a word', exact: true }).click();
  await dialog(page).getByRole('textbox', { name: 'English word' }).fill('useful');
  await dialog(page).getByRole('button', { name: 'Translate', exact: true }).click();
  await expect(dialog(page).getByText('Meaning: useful')).toBeVisible();
  await expect(dialog(page).getByText(/German/)).toBeVisible();
});

test('native language remains editable when translation status fails', async ({ page }) => {
  await installTauriFixture(page, { translation: { statusError: true } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const nativeLanguage = page.getByRole('combobox', { name: 'Native language' });
  await expect(nativeLanguage).toHaveValue('ru');
  await expect(
    page.getByText('Translation availability could not be checked. Retry.'),
  ).toBeVisible();
  await nativeLanguage.selectOption('de');
  await expect(nativeLanguage).toHaveValue('de');
  expect(
    (await harnessState(page)).calls.filter(
      (call) => call.command === 'prepare_translation_languages',
    ),
  ).toEqual([]);
});

test('an unavailable English explanation preserves the translation and can be retried', async ({
  page,
}) => {
  await installTauriFixture(page, {
    learningMemory: mistakeMemory,
    translation: { failNextExplanation: true },
  });
  await openMemory(page);
  await page.getByRole('button', { name: 'Translate a word', exact: true }).click();
  await dialog(page).getByRole('textbox', { name: 'English word' }).fill('useful');
  await dialog(page).getByRole('button', { name: 'Translate', exact: true }).click();
  await expect(dialog(page).getByText('Перевод: useful')).toBeVisible();
  await expect(
    dialog(page).getByText('Apple could not explain this word. Retry for an English explanation.'),
  ).toBeVisible();
  await dialog(page).getByRole('button', { name: /Retry/ }).click();
  await expect(dialog(page).getByText('A simple English explanation of useful.')).toBeVisible();
});
