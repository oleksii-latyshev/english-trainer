import { restoredSpeakingReview } from '../data/builders';
import { noAudio, writtenAnswer } from '../data/sessions';
import { expect, test } from '../fixtures';

test('restored speaking review separates saved answers and preserves its summary stage', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const saved = restoredSpeakingReview();
  tauri.session.withOpenSession(saved.session, saved.dialogue);
  await app.open();
  await start.continueSession();

  await expect(talk.reviewSpeakingHeading).toBeVisible();
  await expect(talk.writtenAnswerCard).toContainText('Written answer 1');
  await expect(talk.writtenAnswerCard).toContainText(
    'The present perfect connects this routine to now.',
  );
  await expect(talk.spokenAnswersContain('Spoken answer 1')).toBeVisible();
  await expect(talk.spokenAnswersContain('Checking your answer…')).toBeVisible();
  await expect(talk.writtenAnswersContain('I have used it for a year.')).toHaveCount(0);
  await expect(
    talk.spokenAnswersContain('I have used a small task board to plan my day.'),
  ).toHaveCount(0);
  expect(await tauri.speech.counts()).toEqual(noAudio);

  await talk.finish();
  await expect(wrapup.heading).toBeVisible();
  await expect(
    wrapup.summaryLine('Work & technology · Write, then speak · Review speaking · 0 s'),
  ).toBeVisible();
  expect(await tauri.session.finished()).toMatchObject({
    practice_mode: 'write_then_speak',
    practice_phase: 'speaking_review',
    turn_count: 2,
    written_turn_count: 1,
    spoken_turn_count: 1,
  });
  expect(await tauri.speech.counts()).toEqual(noAudio);
});

test('Text chat stays text-only through review and carries its mode and counts into the summary', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  await app.open();
  await app.sidebar.openSpeak();
  await start.chooseTextChat();
  await start.startTextChat();
  await expect(talk.writeHeading).toBeVisible();
  expect(await tauri.speech.counts()).toEqual(noAudio);

  await talk.composer.writeAndSend(writtenAnswer);
  await expect(talk.reply).toBeVisible();
  await expect(talk.reviewWritingButton).toBeVisible();
  expect(await tauri.session.activeSession()).toMatchObject({
    practice_mode: 'text_chat',
    practice_phase: 'writing',
    turn_count: 1,
    written_turn_count: 0,
    spoken_turn_count: 0,
  });
  expect(await tauri.calls()).toContainEqual(
    expect.objectContaining({
      command: 'send_practice_turn',
      args: expect.objectContaining({ inputSource: 'text', transcript: writtenAnswer }),
    }),
  );
  expect(await tauri.speech.counts()).toEqual(noAudio);

  await talk.reviewWriting();
  await expect(talk.reviewWritingHeading).toBeVisible();
  await expect(talk.writtenAnswerOne).toBeVisible();
  await talk.finish();
  await expect(wrapup.heading).toBeVisible();
  await expect(
    wrapup.summaryLine('Work & technology · Text chat · Review writing · 0 s'),
  ).toBeVisible();
  expect(await tauri.session.finished()).toMatchObject({
    practice_mode: 'text_chat',
    practice_phase: 'writing_review',
    turn_count: 1,
    written_turn_count: 1,
    spoken_turn_count: 0,
  });
  expect(await tauri.speech.counts()).toEqual(noAudio);
});
