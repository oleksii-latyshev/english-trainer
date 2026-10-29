import { daysAgo, spokenToday } from '../data/activity';
import { initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';

test('the speaking activity grid shows what was spoken, read from local data', async ({
  app,
  start,
  tauri,
}) => {
  tauri.activity.with([spokenToday, daysAgo(40, 9)]);
  await app.open();

  await expect(start.activity).toContainText(/21 min in the last \d+ weeks · 2 days you spoke/);
  await expect(start.activity.getByTitle(/ · 12 min$/)).toHaveCount(1);
  await expect(start.activity.getByTitle(/ · 9 min$/)).toHaveCount(1);
  await expect(start.thisWeek).toContainText('12');
  expect(await tauri.calls('get_speaking_activity')).toHaveLength(1);
});

test('before the first conversation the activity stays calm instead of showing zeros', async ({
  app,
  start,
}) => {
  await app.open();

  await expect(start.activity).toContainText(
    'Your speaking days will appear here after your first conversation.',
  );
  await expect(start.activity).not.toContainText('0 min');
  await expect(start.thisWeek).toContainText('0');
});

test('a due phrase is offered as a warm-up and Review now opens Memory', async ({
  app,
  memory,
  start,
  tauri,
}) => {
  tauri.review.withDuePhrase();
  await app.open();

  await expect(start.warmupCard).toContainText('find a compromise');
  await expect(start.warmupCard).toContainText('1 due');
  await start.warmupCard.getByRole('button', { name: 'Review now' }).click();
  await expect(memory.mistakePracticeHeading).toBeVisible();
});

test('usual mistakes list the rules that come back and open Mistakes', async ({
  app,
  mistakes,
  start,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  await app.open();

  await expect(start.usualMistakes).toContainText('Past Simple vs Present Perfect');
  await expect(start.usualMistakes).toContainText('Subject-verb agreement');
  await start.openMistakes();

  await expect(mistakes.heading).toBeVisible();
});

test('without a mistake the usual-mistakes card is not shown', async ({ app, start }) => {
  await app.open();

  await expect(start.heading).toBeVisible();
  await expect(start.usualMistakes).toHaveCount(0);
});

test('a saved name appears in the greeting and a blank name leaves it unchanged', async ({
  app,
  start,
  tauri,
}) => {
  tauri.profile.with({ name: 'Oleksii' });
  await app.open();

  await expect(start.heading).toHaveText(/^Good (morning|afternoon|evening), Oleksii$/);
});

test('without a name the greeting stays as it was', async ({ app, start }) => {
  await app.open();

  await expect(start.heading).toHaveText(/^Good (morning|afternoon|evening)$/);
});

test('the name saved in Settings greets the learner on Start', async ({
  app,
  settings,
  start,
  tauri,
}) => {
  await app.open();
  await app.sidebar.openSettings();
  await settings.saveName('  Oleksii ');

  const saved = await tauri.calls('save_personal_profile');
  expect(saved[saved.length - 1]?.args).toMatchObject({ profile: { name: '  Oleksii ' } });
  await app.sidebar.openTalk();
  await expect(start.heading).toHaveText(/^Good (morning|afternoon|evening), Oleksii$/);
});

test('a name longer than forty characters is not saved', async ({ app, settings, tauri }) => {
  await app.open();
  await app.sidebar.openSettings();
  await settings.saveName('x'.repeat(41));

  await expect(app.alert).toContainText('Name must be 40 characters or fewer.');
  expect(await tauri.calls('save_personal_profile')).toHaveLength(0);
});

test('a session without a time limit starts, and Talk shows the time without a goal or bar', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await app.open();
  await app.sidebar.openSpeak();

  await start.chooseNoLimit();
  await start.start();

  await expect(talk.openingQuestion).toBeVisible();
  expect(await tauri.session.lastOptions()).toMatchObject({ duration_goal_seconds: null });
  expect((await tauri.session.activeSession())?.duration_goal_seconds).toBeNull();
  await expect(talk.sessionProgressLabel).toHaveText(/^\d\d:\d\d · Speak$/);
  await expect(talk.sessionTimeBar).toHaveCount(0);
});

test('a session with a goal still shows the goal and the bar in Talk', async ({
  app,
  start,
  talk,
}) => {
  await app.open();
  await app.sidebar.openSpeak();

  await start.chooseLength(5);
  await start.start();

  await expect(talk.sessionProgressLabel).toHaveText(/^\d\d:\d\d of 05:00 · Speak$/);
  await expect(talk.sessionTimeBar).toHaveCount(1);
});

test('the resume card of a no-limit session says how long it has run so far', async ({
  app,
  start,
  tauri,
}) => {
  tauri.session.withOpenSession({
    ...initialSession,
    duration_goal_seconds: null,
    active_duration_ms: 7 * 60_000,
  });
  await app.open();

  await expect(start.openConversation).toContainText('7 min so far');
  await expect(start.openConversation).not.toContainText('min left');
});

test('a session with a goal resumes with the minutes left', async ({ app, start, tauri }) => {
  tauri.session.withOpenSession({ ...initialSession, active_duration_ms: 7 * 60_000 });
  await app.open();

  await expect(start.openConversation).toContainText('3 min left');
});

for (const width of [900, 1600]) {
  test(`the speaking activity ends with this week inside the card at ${width}px, without scrolling`, async ({
    app,
    page,
    start,
    tauri,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    tauri.activity.with([spokenToday]);
    await app.open();

    const today = start.activity.getByTitle(/ · 12 min$/);
    await expect(today).toBeVisible();
    const card = await start.activity.boundingBox();
    const cell = await start.activity.locator('span[title]').last().boundingBox();
    expect(cell && card && cell.x + cell.width <= card.x + card.width).toBe(true);
    const scrolls = await start.activity.evaluate((element) =>
      [element, ...element.querySelectorAll('*')].some(
        (node) =>
          node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX !== 'visible',
      ),
    );
    expect(scrolls).toBe(false);
  });
}
