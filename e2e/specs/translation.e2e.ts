import { noAudio } from '../data/sessions';
import { wordDialogue, wordSession } from '../data/translation';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { App } from '../pages/app';
import type { MistakesPage } from '../pages/mistakes-page';

async function openMistakeCard(app: App, mistakes: MistakesPage, tauri: FakeBackend) {
  tauri.mistakes.withUniversityQuestion();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.open('in the university');
  await expect(mistakes.question).toBeVisible();
}

test('Memory translates a selected word only after an explicit action', async ({
  app,
  mistakes,
  tauri,
}) => {
  await openMistakeCard(app, mistakes, tauri);
  const { translation } = app;
  await translation.select(mistakes.question, 'university');
  await expect(translation.offerFor('university')).toBeVisible();
  expect(await tauri.calls('translate_text')).toEqual([]);
  await translation.translateSelected('university');
  await expect(translation.text('Перевод: university')).toBeVisible();
  await expect(translation.text('A simple English explanation of university.')).toBeVisible();
  const requests = await tauri.calls('translate_text');
  expect(requests).toHaveLength(1);
  expect(requests[0]?.args.request).toMatchObject({ text: 'university' });
  expect(await tauri.speech.counts()).toEqual(noAudio);
});

test('a selected phrase is translated whole and unmarked text offers nothing', async ({
  app,
  mistakes,
  tauri,
}) => {
  await openMistakeCard(app, mistakes, tauri);
  const { translation } = app;
  await translation.select(mistakes.question, 'at university');
  await expect(translation.offerFor('at university')).toBeVisible();
  expect(await tauri.calls('translate_text')).toEqual([]);
  await translation.translateSelected('at university');
  await expect(translation.text('Перевод: at university')).toBeVisible();
  await expect(translation.text('A simple English explanation of at university.')).toBeVisible();
  await translation.close();
  await translation.select(mistakes.eyebrow, 'Eva');
  await expect(translation.anyOffer).toHaveCount(0);
  expect(await tauri.calls('translate_text')).toHaveLength(1);
});

test('a whole sentence of up to eight words can be translated from Talk', async ({
  app,
  start,
  tauri,
}) => {
  tauri.session.withOpenSession(wordSession, wordDialogue);
  await app.open();
  await start.continueSession();
  const { translation } = app;
  const sentence = 'Which useful tool helps you plan your projects';
  await translation.select(app.exactText(wordSession.opening_question), sentence);
  await translation.translateSelected(sentence);
  await expect(translation.text(`Перевод: ${sentence}`)).toBeVisible();
  const requests = await tauri.calls('translate_text');
  expect(requests[0]?.args.request).toMatchObject({ text: sentence });
});

test('Talk and the wrap-up review share local word lookup without sending answers', async ({
  app,
  start,
  talk,
  wrapup,
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
  await talk.finish();
  await expect(wrapup.heading).toBeVisible();
  await translation.select(
    app.exactText('The present perfect connects your experience to now.'),
    'experience',
  );
  await translation.translateSelected('experience');
  await expect(translation.text('Перевод: experience')).toBeVisible();
  expect(await tauri.calls('send_practice_turn')).toEqual([]);
  expect(await tauri.speech.counts()).toEqual(noAudio);
});

test('keyboard lookup accepts a phrase, rejects long text and retries provider errors', async ({
  app,
  mistakes,
  tauri,
}) => {
  tauri.translation.failingNextTranslation();
  await openMistakeCard(app, mistakes, tauri);
  const { translation } = app;
  await translation.open();
  await translation.submitWithKeyboard('one two three four five six seven eight nine');
  await expect(translation.alert).toContainText('short phrase');
  expect(await tauri.calls('translate_text')).toEqual([]);
  await translation.submitWithKeyboard('useful');
  await expect(translation.alert).toContainText('Translation could not finish');
  await translation.retryButton.click();
  await expect(translation.text('Перевод: useful')).toBeVisible();
  await translation.submitWithKeyboard('take it for granted');
  await expect(translation.text('Перевод: take it for granted')).toBeVisible();
  await translation.dismissWithKeyboard();
  await expect(translation.dialog).toHaveCount(0);
});

test('missing models are prepared only by an explicit action', async ({ app, mistakes, tauri }) => {
  tauri.translation.needingLanguageDownload();
  await openMistakeCard(app, mistakes, tauri);
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
  mistakes,
  tauri,
}) => {
  tauri.translation.delayingWord('useful');
  await openMistakeCard(app, mistakes, tauri);
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
  mistakes,
  tauri,
}) => {
  tauri.translation.failingNextExplanation();
  await openMistakeCard(app, mistakes, tauri);
  const { translation } = app;
  await translation.open();
  await translation.lookUp('useful');
  await expect(translation.text('Перевод: useful')).toBeVisible();
  await expect(
    translation.text('Apple could not explain this phrase. Retry for an English explanation.'),
  ).toBeVisible();
  await translation.explanationRetryButton.click();
  await expect(translation.text('A simple English explanation of useful.')).toBeVisible();
});
