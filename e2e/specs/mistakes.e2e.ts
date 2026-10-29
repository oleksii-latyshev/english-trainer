import { expect, test } from '../fixtures';

const SHOTS = process.env.MISTAKES_SHOTS;

test('the sidebar badge counts the mistakes ready to practise', async ({ app, tauri }) => {
  tauri.mistakes.withGroups();
  await app.open();

  await expect(app.sidebar.mistakesBadge).toBeVisible();
});

test('the list is grouped by rule with a last group for the unsorted', async ({
  app,
  page,
  mistakes,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();

  await expect(mistakes.heading).toBeVisible();
  await expect(mistakes.overview).toContainText('10 mistakes in 2 rules');
  const perfect = mistakes.group('Past Simple vs Present Perfect');
  await expect(perfect).toContainText('Came back on');
  await expect(perfect).toContainText('2 fixed');
  await expect(perfect).toContainText('and 6 more');
  await expect(perfect.getByRole('button', { name: /^I work on it since March/ })).toBeVisible();
  await expect(mistakes.group('Subject-verb agreement')).toBeVisible();
  await expect(mistakes.group('Not sorted yet')).toContainText('He go home.');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/mistakes-list.png` });
});

test('the full rule opens inside its group', async ({ app, mistakes, tauri }) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.group('Past Simple vs Present Perfect').getByText('Open the full rule').click();

  await expect(app.text('Use Past Simple for a finished time')).toBeVisible();
});

test('Practise counts the due mistakes and is on when something is due', async ({
  app,
  mistakes,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();

  await expect(mistakes.practiseAll).toBeEnabled();
  await expect(mistakes.practiseAll).toContainText('Practise 3 · 5 min');
  await expect(mistakes.practiseRule('Subject-verb agreement')).toBeEnabled();
});

test('a mistake card shows the version to keep and a ready lesson', async ({
  app,
  page,
  mistakes,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.open('I work on it since March.');

  await expect(app.text('How long have you been working on this project?')).toBeVisible();
  await expect(app.text('Version to keep')).toBeVisible();
  await expect(mistakes.versionToKeep.locator('mark')).toHaveText(['have', 'been', 'working']);
  await expect(mistakes.lesson).toContainText('Since March');
  await expect(mistakes.lesson).toContainText('Up to now');
  await expect(mistakes.practiseThis).toBeEnabled();
  await expect(mistakes.hearIt).toBeEnabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/mistake-card.png` });
});

test('a pending lesson shows the mistake and turns ready when Eva finishes', async ({
  app,
  mistakes,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.open('that move');

  await expect(mistakes.preparingLesson).toBeVisible();
  await expect(app.text('that moves')).toBeVisible();
  await tauri.mistakes.land(2);

  await expect(mistakes.preparingLesson).toHaveCount(0);
  await expect(mistakes.lesson).toContainText('Present Perfect links the past to now.');
});

test('a failed lesson can be retried', async ({ app, mistakes, tauri }) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.open('He go home.');
  await mistakes.retry.click();

  await expect(mistakes.preparingLesson).toBeVisible();
  expect(await tauri.calls('retry_mistake_lesson')).toHaveLength(1);
});

test('archiving a mistake returns to the list without it', async ({ app, mistakes, tauri }) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.open('He go home.');
  await mistakes.archive.click();

  await expect(mistakes.heading).toBeVisible();
  await expect(mistakes.group('Not sorted yet')).toHaveCount(0);
  expect(await tauri.calls('archive_mistake')).toHaveLength(1);
});

test('without mistakes the screen explains where they come from', async ({ app, mistakes }) => {
  await app.open();
  await app.sidebar.openMistakes();

  await expect(mistakes.emptyState).toBeVisible();
  await expect(mistakes.practiseAll).toBeDisabled();
});

test('Talk it through starts the spoken practice from rules that hold two mistakes', async ({
  app,
  mistakes,
  talk,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.talkItThrough.click();

  await expect(talk.questionProgress(1, 5)).toBeVisible();
});

test('Talk it through is off while every rule holds a single mistake', async ({
  app,
  mistakes,
  tauri,
}) => {
  tauri.mistakes.withSingleMistakeRules();
  await app.open();
  await app.sidebar.openMistakes();

  await expect(mistakes.talkItThrough).toBeDisabled();
  await expect(app.text('A rule needs at least two mistakes first.')).toBeVisible();
  expect(await tauri.calls('start_mistake_practice')).toEqual([]);
});
