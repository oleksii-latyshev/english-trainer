import { savedMistakePractice } from '../data/builders';
import { finalHeardAnswer } from '../data/rescue';
import { initialSession, noAudio } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { TalkPage } from '../pages/talk-page';

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
  tauri.mistakes.withGroups();
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
  tauri.mistakes.withGroups();
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
  tauri.mistakes.withGroups();
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

const QUESTIONS = 5;

async function answerByVoice(talk: TalkPage, tauri: FakeBackend, answered: number): Promise<void> {
  await talk.recorder.startAndWaitForSignal();
  await talk.recorder.stopAndReview();
  await expect(talk.recorder.heardField).toHaveValue(finalHeardAnswer);
  await talk.composer.send();
  await expect.poll(async () => (await tauri.session.dialogue())?.turns.length).toBe(answered);
}

test('a started mistake run takes five voice answers and finishes with pending coaching', async ({
  app,
  memory,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.memory.withRepeatedMistake();
  tauri.rescue.available();
  tauri.streaming.withWarmMicrophone();
  await app.open();
  await app.sidebar.openMemory();
  await memory.startPractice();

  for (let answered = 0; answered < QUESTIONS; answered += 1) {
    await expect(talk.questionProgress(answered + 1, QUESTIONS)).toBeVisible();
    await answerByVoice(talk, tauri, answered + 1);
  }

  await expect(talk.practiceComplete).toBeVisible();
  expect(await tauri.calls('start_mistake_practice')).toHaveLength(1);
  await talk.finish();
  await expect(wrapup.heading).toBeVisible();
  expect(await tauri.session.finished()).toMatchObject({
    is_mistake_practice: true,
    turn_count: QUESTIONS,
    target_turns: QUESTIONS,
  });
});

test('a mistake run left after two answers resumes at the third question', async ({
  app,
  memory,
  talk,
  tauri,
}) => {
  tauri.mistakes.withGroups();
  tauri.memory.withRepeatedMistake();
  tauri.rescue.available();
  tauri.streaming.withWarmMicrophone();
  await app.open();
  await app.sidebar.openMemory();
  await memory.startPractice();
  await answerByVoice(talk, tauri, 1);
  await answerByVoice(talk, tauri, 2);

  await app.sidebar.openSettings();
  await app.sidebar.openTalk();

  await expect(talk.questionProgress(3, QUESTIONS)).toBeVisible();
  expect(await tauri.calls('start_mistake_practice')).toHaveLength(1);
});
