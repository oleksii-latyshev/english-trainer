import { initialSession, noAudio, writtenAnswer } from '../data/sessions';
import { expect, test } from '../fixtures';

test('free topic needs a subject and start saves the selected topic and length', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await app.open();
  await app.sidebar.openSpeak();

  await start.chooseFreeTopic();
  await expect(start.startButton).toBeDisabled();
  await start.describeTopic('A book I enjoyed');
  await start.chooseLength(5);
  await start.start();

  await expect(talk.openingQuestion).toBeVisible();
  expect(await tauri.session.lastOptions()).toEqual({
    topic_id: 'free_topic',
    topic_custom: 'A book I enjoyed',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
  });
});

test('a start error can be retried without leaving the start screen', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.session.failingNextStart();
  await app.open();
  await app.sidebar.openSpeak();

  await start.start();
  await expect(app.alert).toContainText('Could not start practice');
  await start.tryAgain();

  await expect(talk.finishButton).toBeVisible();
});

test('an open session is offered as Continue and restores Talk', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.session.withOpenSession({ ...initialSession });
  await app.open();

  await expect(start.openConversation).toBeVisible();
  await start.continueSession();
  await expect(talk.finishButton).toBeVisible();
  await expect(talk.openingQuestion).toBeVisible();
});

test('typed answers save as text and show the reply while coaching remains pending', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await app.open();
  await app.sidebar.openSpeak();
  await start.start();
  await expect(talk.finishButton).toBeVisible();
  await talk.composer.typeInsteadAndSend(writtenAnswer);

  await expect(talk.reply).toBeVisible();
  await expect(talk.beingChecked).toBeVisible();
  expect(await tauri.calls()).toContainEqual(
    expect.objectContaining({
      command: 'send_practice_turn',
      args: expect.objectContaining({ inputSource: 'text', transcript: writtenAnswer }),
    }),
  );
});

test('a failed send keeps the draft available for retry', async ({ app, start, talk, tauri }) => {
  tauri.session.failingNextSend();
  await app.open();
  await app.sidebar.openSpeak();
  await start.start();
  await talk.composer.typeInstead();
  await talk.composer.writeAndSend(writtenAnswer);

  await expect(app.alert).toContainText('could not be generated');
  await expect(talk.composer.answer).toHaveValue(writtenAnswer);
  await talk.composer.send();
  await expect(talk.reply).toBeVisible();
});

test('finishing shows the session topic and Talk more returns home', async ({
  app,
  start,
  talk,
  wrapup,
}) => {
  await app.open();
  await app.sidebar.openSpeak();
  await start.start();
  await talk.finish();

  await expect(wrapup.heading).toBeVisible();
  await expect(wrapup.summaryLine('Work & technology · Speak · Speaking · 0 s')).toBeVisible();
  await wrapup.talkMore();
  await expect(start.heading).toBeVisible();
});

test('an unconfigured IPC command rejects visibly in the fixture', async ({ app, tauri }) => {
  tauri.expectUnhandledCommands();
  await app.open();

  const message = await tauri.invokeUnknownCommand('unexpected_command');
  expect(message).toBe('Unhandled Tauri command in E2E fixture: unexpected_command');
  expect(await tauri.unhandledCommandErrors()).toEqual([
    'Unhandled Tauri command in E2E fixture: unexpected_command',
  ]);
});

test('write then speak waits for Ready before opening audio and retries a failed phase change', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.session.failingNextTransition();
  await app.open();
  await app.sidebar.openSpeak();
  await start.chooseWriteThenSpeak();
  await start.startWriting();
  await expect(talk.writeHeading).toBeVisible();

  expect(await tauri.speech.counts()).toEqual(noAudio);
  await talk.pressSpaceOnPage();
  await expect.poll(() => tauri.speech.counts()).toEqual(noAudio);

  await talk.composer.writeAndSend(writtenAnswer);
  await expect(talk.reply).toBeVisible();
  await expect(talk.reviewWritingButton).toBeVisible();
  await expect.poll(() => tauri.speech.counts()).toEqual(noAudio);
  expect((await tauri.session.activeSession())?.written_turn_count).toBe(0);

  await talk.reviewWriting();
  await expect(talk.reviewWritingHeading).toBeVisible();
  await expect(talk.writtenAnswerOne).toBeVisible();
  expect((await tauri.session.activeSession())?.written_turn_count).toBe(1);
  await expect.poll(() => tauri.speech.counts()).toEqual(noAudio);

  await talk.readyToSpeak();
  await expect(talk.reviewWritingHeading).toBeVisible();
  await expect(app.alert).toContainText('Could not move to the next practice stage');
  await expect.poll(() => tauri.speech.counts()).toEqual(noAudio);

  await talk.readyToSpeak();
  await expect(talk.originalQuestion).toBeVisible();
  await expect.poll(async () => (await tauri.speech.counts()).mediaRequests).toBeGreaterThan(0);
  await expect(talk.microphoneStatus).toContainText('Not available right now.');
  await expect(talk.originalQuestion).toBeVisible();
  const session = await tauri.session.activeSession();
  expect(session?.written_turn_count).toBe(1);
  expect(session?.spoken_turn_count).toBe(0);
});
