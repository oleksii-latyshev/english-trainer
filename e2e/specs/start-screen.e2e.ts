import { daysAgo, spokenToday } from '../data/activity';
import { expect, test } from '../fixtures';

test('the speaking activity grid shows 26 weeks and what was spoken, read from local data', async ({
  app,
  start,
  tauri,
}) => {
  tauri.activity.with([spokenToday, daysAgo(40, 9)]);
  await app.open();

  await expect(start.activity).toContainText('21 min in 6 months · 2 days you spoke');
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

test('usual mistakes start the five-question practice from the Start screen', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake().preparingMistakePracticeFor(0);
  await app.open();

  await expect(start.usualMistakes).toContainText('in the university');
  await expect(start.usualMistakes).toContainText('at university');
  await start.practiseUsualMistakes();

  await expect(talk.questionProgress(1, 5)).toBeVisible();
});

test('without a repeated mistake the usual-mistakes card is not shown', async ({
  app,
  start,
  tauri,
}) => {
  tauri.memory.withoutPracticableMistakes();
  await app.open();

  await expect(start.heading).toBeVisible();
  await expect(start.usualMistakes).toHaveCount(0);
});
