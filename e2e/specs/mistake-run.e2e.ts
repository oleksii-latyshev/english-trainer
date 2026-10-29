import {
  fixItItem,
  pullRequestItem,
  SPOKEN_WRONG,
  sayItItem,
  useItItem,
} from '../data/mistake-run';
import { initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';

const SHOTS = process.env.MISTAKES_SHOTS;

test('Practise starts the run on the first exercise with its rule', async ({
  app,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.available();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();

  await expect(mistakeRun.progress(1, 4)).toBeVisible();
  await expect(mistakeRun.position('1 of 4 · Subject-verb agreement')).toBeVisible();
  await expect(mistakeRun.exercise('Fill the gaps')).toContainText(
    'Eva asked: What does this pull request change?',
  );
  expect(await tauri.calls('start_mistake_run')).toEqual([
    expect.objectContaining({ args: { kind: 'due' } }),
  ]);
});

test('a miss shows the version to keep and offers one free retry', async ({
  app,
  page,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.available();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();
  await mistakeRun.fillGap('move');

  await expect(mistakeRun.notQuite).toBeVisible();
  await expect(
    app.text('“It is a pull request that moves the settings into one screen.”'),
  ).toBeVisible();
  await expect(app.text('so the verb takes -s.')).toBeVisible();
  await expect(mistakeRun.next).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-miss.png` });

  await mistakeRun.tryOnceMore.click();
  await expect(mistakeRun.practiceOnly).toBeVisible();
  await mistakeRun.fillGap('moves');

  await expect(app.text('That matches the version to keep.')).toBeVisible();
  await expect(mistakeRun.tryOnceMore).toHaveCount(0);
  await mistakeRun.next.click();
  await expect(mistakeRun.exercise('Fix it')).toBeVisible();
  const answers = await tauri.calls('answer_mistake_step');
  expect(answers.map((call) => call.args)).toEqual([
    { runId: 7, position: 0, answer: 'move', input: 'typed' },
    { runId: 7, position: 0, answer: 'moves', input: 'typed' },
  ]);
});

test('a right answer says so and moves on', async ({ app, mistakes, mistakeRun, tauri }) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.available();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();
  await mistakeRun.fillGap('moves');

  await expect(mistakeRun.right).toBeVisible();
  await mistakeRun.next.click();
  await expect(mistakeRun.progress(2, 4)).toBeVisible();
});

test('Fix it asks Eva to check a miss and the result fills in later', async ({
  app,
  page,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.withExercises([fixItItem]);
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();
  await expect(mistakeRun.fixField).toHaveValue('He go home.');
  await mistakeRun.fixSentence('He went home.');

  await expect(mistakeRun.notQuite).toBeVisible();
  await mistakeRun.checkIt.click();
  await expect(mistakeRun.checking).toBeVisible();
  await expect(mistakeRun.checkIt).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-checking.png` });

  await tauri.mistakeRun.resolveCheck(0, 'pass');
  await expect(mistakeRun.right).toBeVisible();
  await expect(mistakeRun.checking).toHaveCount(0);
  expect(await tauri.calls('check_mistake_answer')).toEqual([
    expect.objectContaining({ args: { runId: 7, position: 0 } }),
  ]);
});

test('Say it records the answer and compares the local transcript', async ({
  app,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.speech.grantMicrophone();
  tauri.mistakeRun.withExercises([sayItItem]).hearing(SPOKEN_WRONG);
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();
  await expect(mistakeRun.hearQuestion).toBeVisible();
  await mistakeRun.answerAloud();

  await expect(mistakeRun.notQuite).toBeVisible();
  await expect(app.text(`You said: “${SPOKEN_WRONG}”`)).toBeVisible();
  expect(await tauri.calls('answer_mistake_step')).toEqual([
    expect.objectContaining({
      args: { runId: 7, position: 0, answer: SPOKEN_WRONG, input: 'spoken' },
    }),
  ]);
});

test('Use it moves on while Eva checks and the summary follows the result', async ({
  app,
  page,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.speech.grantMicrophone();
  tauri.mistakeRun.withExercises([useItItem, sayItItem]);
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();
  await mistakeRun.answerAloud();
  await expect(mistakeRun.checking).toBeVisible();
  await mistakeRun.next.click();

  await expect(mistakeRun.exercise('Say it')).toBeVisible();
  await mistakeRun.answerAloud();
  await expect(mistakeRun.right).toBeVisible();
  await mistakeRun.finish.click();

  await expect(mistakeRun.summary).toContainText('Practice done');
  await expect(mistakeRun.summaryRow('Use it')).toContainText('Checking…');
  await expect(mistakeRun.summaryRow('Say it')).toContainText('Right');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-summary.png` });
  await tauri.mistakeRun.resolveCheck(0, 'miss');

  await expect(mistakeRun.summaryRow('Use it')).toContainText('Not quite');
  expect(await tauri.calls('finish_mistake_run')).toHaveLength(1);
  await mistakeRun.backToMistakes.click();
  await expect(mistakes.heading).toBeVisible();
});

test('a check that did not finish offers Retry', async ({ app, mistakes, mistakeRun, tauri }) => {
  tauri.mistakes.withGroups();
  tauri.speech.grantMicrophone();
  tauri.mistakeRun.withExercises([useItItem]);
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();
  await mistakeRun.answerAloud();
  await expect(mistakeRun.checking).toBeVisible();
  await expect(mistakeRun.retryCheck).toHaveCount(0);

  await tauri.mistakeRun.failCheck(0);
  await expect(mistakeRun.checkFailed).toBeVisible();
  await mistakeRun.retryCheck.click();

  await expect(mistakeRun.checking).toBeVisible();
  expect(await tauri.calls('retry_mistake_check')).toHaveLength(1);
});

test('an open run resumes at the first exercise without an answer', async ({
  app,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.withAnsweredExercises(2);
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();

  await expect(mistakeRun.progress(3, 4)).toBeVisible();
  await expect(mistakeRun.exercise('Say it')).toBeVisible();
});

test('End practice leaves the unanswered exercises out of the summary result', async ({
  app,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.available();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();
  await mistakeRun.fillGap('moves');
  await mistakeRun.endPractice.click();

  await expect(mistakeRun.summary).toContainText('1 of 4 right');
  await expect(mistakeRun.summaryRow('Fix it')).toContainText('Not practised');
  expect(await tauri.calls('finish_mistake_run')).toHaveLength(1);
});

test('the microphone stays off while a conversation is open', async ({
  app,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.session.withOpenSession(initialSession);
  tauri.mistakeRun.withExercises([sayItItem]);
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseAll.click();

  await expect(mistakeRun.recordAnswer).toBeDisabled();
  await expect(app.text('Continue or finish the current conversation')).toBeVisible();
});

test('Practise this on a card starts a run for that mistake', async ({
  app,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.withExercises([pullRequestItem]);
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.open('I work on it since March.');
  await mistakes.practiseThis.click();

  await expect(mistakeRun.exercise('Fill the gaps')).toBeVisible();
  expect(await tauri.calls('start_mistake_run')).toEqual([
    expect.objectContaining({ args: { kind: 'one', id: 1 } }),
  ]);
});

test('Practise this rule on a group starts a run for that rule', async ({
  app,
  mistakes,
  mistakeRun,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.mistakeRun.available();
  await app.open();
  await app.sidebar.openMistakes();
  await mistakes.practiseRule('Past Simple vs Present Perfect').click();

  await expect(mistakeRun.exercise('Fill the gaps')).toBeVisible();
  expect(await tauri.calls('start_mistake_run')).toEqual([
    expect.objectContaining({ args: { kind: 'rule', ruleKey: 'past_simple_vs_present_perfect' } }),
  ]);
});
