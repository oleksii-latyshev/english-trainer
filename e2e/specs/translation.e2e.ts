import { noAudio } from '../data/sessions';
import { wordDialogue, wordSession } from '../data/translation';
import { expect, test } from '../fixtures';
import type { App } from '../pages/app';
import type { MemoryPage } from '../pages/memory-page';

async function openMistakes(app: App, memory: MemoryPage) {
  await app.open();
  await app.sidebar.openMemory();
  await memory.openMistakes();
  await expect(memory.correctedExample('at university')).toBeVisible();
}

test('Memory translates one selected word only after an explicit action', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake();
  await openMistakes(app, memory);
  const { translation } = app;
  await translation.select(memory.correctedExample('at university'), 'university');
  await expect(translation.offerFor('university')).toBeVisible();
  expect(await tauri.calls('translate_word')).toEqual([]);
  await translation.translateSelected('university');
  await expect(translation.text('Перевод: university')).toBeVisible();
  await expect(translation.text('A simple English explanation of university.')).toBeVisible();
  const requests = await tauri.calls('translate_word');
  expect(requests).toHaveLength(1);
  expect(requests[0]?.args.request).toMatchObject({ word: 'university' });
  expect(await tauri.speech.counts()).toEqual(noAudio);
});

test('multiword and unmarked selections do not offer contextual translation', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake();
  await openMistakes(app, memory);
  const { translation } = app;
  await translation.select(memory.correctedExample('at university'), 'at university');
  await expect(translation.anyOffer).toHaveCount(0);
  await translation.select(memory.mistakePracticeHeading, 'Practice');
  await expect(translation.anyOffer).toHaveCount(0);
  expect(await tauri.calls('translate_word')).toEqual([]);
});

test('Talk and inline coaching share local word lookup without sending answers', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.session.withOpenSession(wordSession, wordDialogue);
  await app.open();
  await start.continueSession();
  const { translation } = app;
  await translation.select(app.exactText(wordSession.opening_question), 'projects');
  await translation.translateSelected('projects');
  await expect(translation.text('Перевод: projects')).toBeVisible();
  await translation.close();
  await expect(talk.collapseNoteButton).toBeVisible();
  await translation.select(
    app.exactText('The present perfect connects your experience to now.'),
    'experience',
  );
  await translation.translateSelected('experience');
  await expect(translation.text('Перевод: experience')).toBeVisible();
  expect(await tauri.calls('send_practice_turn')).toEqual([]);
  expect(await tauri.speech.counts()).toEqual(noAudio);
});

test('keyboard lookup rejects sentences and retries provider errors', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake();
  tauri.translation.failingNextTranslation();
  await openMistakes(app, memory);
  const { translation } = app;
  await translation.open();
  await translation.submitWithKeyboard('two words');
  await expect(translation.alert).toContainText('one English word');
  expect(await tauri.calls('translate_word')).toEqual([]);
  await translation.submitWithKeyboard('useful');
  await expect(translation.alert).toContainText('Translation could not finish');
  await translation.retryButton.click();
  await expect(translation.text('Перевод: useful')).toBeVisible();
  await translation.dismissWithKeyboard();
  await expect(translation.dialog).toHaveCount(0);
});

test('missing models are prepared only by an explicit action', async ({ app, memory, tauri }) => {
  tauri.memory.withRepeatedMistake();
  tauri.translation.needingLanguageDownload();
  await openMistakes(app, memory);
  const { translation } = app;
  await translation.open();
  await translation.lookUp('useful');
  await expect(translation.alert).toContainText('Prepare languages');
  expect(await tauri.calls('prepare_translation_languages')).toEqual([]);
  await translation.prepareButton.click();
  await expect(translation.text('Translation languages are ready on this Mac.')).toBeVisible();
  await translation.translateButton.click();
  await expect(translation.text('Перевод: useful')).toBeVisible();
});

test('closing a pending lookup prevents its late result from reopening the panel', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake();
  tauri.translation.delayingWord('useful');
  await openMistakes(app, memory);
  const { translation } = app;
  await translation.open();
  await translation.lookUp('useful');
  await expect(translation.pendingStatus).toBeVisible();
  await translation.close();
  await expect.poll(() => tauri.translation.completedLookups()).toBe(1);
  await expect(translation.dialog).toHaveCount(0);
  await translation.open();
  await expect(translation.text('Перевод: useful')).toHaveCount(0);
});

test('native language changes persist and are used by later lookups', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake();
  await app.open();
  await app.sidebar.openSettings();
  await expect(settings.nativeLanguage).toHaveText('Russian');
  await settings.chooseNativeLanguage('German');
  await expect(settings.nativeLanguage).toHaveText('German');
  await expect.poll(async () => (await tauri.calls('save_translation_settings')).length).toBe(1);
  await app.reload();
  await app.sidebar.openSettings();
  await expect(settings.nativeLanguage).toHaveText('German');
  await app.sidebar.openMemory();
  const { translation } = app;
  await translation.open();
  await translation.lookUp('useful');
  await expect(translation.text('Meaning: useful')).toBeVisible();
  await expect(translation.text(/German/)).toBeVisible();
});

test('native language remains editable when translation status fails', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.translation.failingStatusCheck();
  await app.open();
  await app.sidebar.openSettings();
  await expect(settings.nativeLanguage).toHaveText('Russian');
  await expect(settings.statusFailure).toBeVisible();
  await settings.chooseNativeLanguage('German');
  await expect(settings.nativeLanguage).toHaveText('German');
  expect(await tauri.calls('prepare_translation_languages')).toEqual([]);
});

test('an unavailable English explanation preserves the translation and can be retried', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake();
  tauri.translation.failingNextExplanation();
  await openMistakes(app, memory);
  const { translation } = app;
  await translation.open();
  await translation.lookUp('useful');
  await expect(translation.text('Перевод: useful')).toBeVisible();
  await expect(
    translation.text('Apple could not explain this word. Retry for an English explanation.'),
  ).toBeVisible();
  await translation.explanationRetryButton.click();
  await expect(translation.text('A simple English explanation of useful.')).toBeVisible();
});
