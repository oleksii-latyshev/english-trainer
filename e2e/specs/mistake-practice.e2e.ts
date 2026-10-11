import { savedMistakePractice } from '../data/builders';
import { initialSession, noAudio } from '../data/sessions';
import { expect, test } from '../fixtures';

test('usual mistake practice needs a repeated non-archived mistake', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withoutPracticableMistakes();
  await app.open();
  await app.sidebar.openMemory();

  await expect(memory.mistakePracticeHeading).toBeVisible();
  await expect(memory.startPracticeButton).toBeDisabled();
  expect(await tauri.calls('start_mistake_practice')).toEqual([]);
  expect(await tauri.speech.counts()).toEqual(noAudio);
});

test('a repeated mistake can start voice practice even when no items are due', async ({
  app,
  memory,
  talk,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake().preparingMistakePracticeFor(750);
  await app.open();
  await app.sidebar.openMemory();
  await memory.startPractice();

  await expect(talk.preparingQuestions).toBeVisible();
  expect(await tauri.speech.counts()).toEqual(noAudio);
  await expect(app.text('What did you enjoy about your time studying?')).toBeVisible();
  await expect(talk.questionProgress(1, 5)).toBeVisible();
  await expect(talk.typeInsteadButton).toHaveCount(0);
  expect(await tauri.session.activeSession()).toMatchObject({
    is_mistake_practice: true,
    target_turns: 5,
  });
});

test('failed question preparation keeps Memory available for retry', async ({
  app,
  memory,
  talk,
  tauri,
}) => {
  tauri.memory.withRepeatedMistake().failingNextMistakePractice();
  await app.open();
  await app.sidebar.openMemory();
  await memory.startPractice();

  await expect(app.alert).toContainText('Question preparation is unavailable');
  expect(await tauri.session.activeSession()).toBeNull();
  expect(await tauri.speech.counts()).toEqual(noAudio);
  await memory.startPractice();
  await expect(talk.questionProgress(1, 5)).toBeVisible();
});

test('an existing conversation blocks a new mistake practice', async ({ app, memory, tauri }) => {
  tauri.memory.withRepeatedMistake();
  tauri.session.withOpenSession(initialSession);
  await app.open();
  await app.sidebar.openMemory();

  await expect(memory.startPracticeButton).toBeDisabled();
  expect(await tauri.calls('start_mistake_practice')).toEqual([]);
});

test('unfinished mistake practice restores the next question and progress', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  const saved = savedMistakePractice(2);
  tauri.session.withOpenSession(saved.session, saved.dialogue);
  await app.open();
  await start.continueSession();

  await expect(talk.questionProgress(3, 5)).toBeVisible();
  await expect(app.text('What did you learn from your classmates?')).toBeVisible();
  expect(await tauri.calls('start_mistake_practice')).toEqual([]);
});

test('completed mistake questions lock another answer and finish with pending coaching', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const saved = savedMistakePractice(5);
  tauri.session.withOpenSession(saved.session, saved.dialogue);
  await app.open();
  await start.continueSession();

  await expect(talk.practiceComplete).toBeVisible();
  expect((await tauri.speech.counts()).mediaRequests).toBe(0);
  await talk.pressSpaceOnPage();
  expect(await tauri.calls('send_practice_turn')).toEqual([]);
  await talk.finish();
  await expect(wrapup.heading).toBeVisible();
  expect(await tauri.session.finished()).toMatchObject({
    is_mistake_practice: true,
    turn_count: 5,
    target_turns: 5,
    pending_coaching: 1,
  });
});
