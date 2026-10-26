import { finalHeardAnswer } from '../data/rescue';
import { writtenAnswer } from '../data/sessions';
import { expect, test } from '../fixtures';

test('write, review, speak and review run end to end and finish with both stages counted', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.rescue.available();
  tauri.streaming.withWarmMicrophone();
  await app.open();
  await app.sidebar.openSpeak();
  await start.chooseWriteThenSpeak();
  await start.startWriting();
  await expect(talk.writeHeading).toBeVisible();

  await talk.composer.writeAndSend(writtenAnswer);
  await expect(talk.reply).toBeVisible();
  await talk.reviewWriting();
  await expect(talk.reviewWritingHeading).toBeVisible();
  await expect(talk.writtenAnswerCard).toContainText(writtenAnswer);
  await expect(talk.spokenAnswers).toHaveCount(0);

  await talk.readyToSpeak();
  await expect(talk.originalQuestion).toBeVisible();
  await talk.recorder.startAndWaitForSignal();
  await talk.recorder.stopAndReview();
  await expect(talk.recorder.heardField).toHaveValue(finalHeardAnswer);
  await talk.composer.send();
  await expect(talk.reply).toHaveCount(2);

  await talk.reviewSpeaking();
  await expect(talk.reviewSpeakingHeading).toBeVisible();
  await expect(talk.writtenAnswerCard).toContainText('Written answer 1');
  await expect(talk.spokenAnswersContain('Spoken answer 1')).toBeVisible();
  await expect(talk.spokenAnswersContain(finalHeardAnswer)).toBeVisible();

  await talk.finish();
  await expect(wrapup.heading).toBeVisible();
  expect(await tauri.session.finished()).toMatchObject({
    practice_mode: 'write_then_speak',
    practice_phase: 'speaking_review',
    turn_count: 2,
    written_turn_count: 1,
    spoken_turn_count: 1,
  });
});
