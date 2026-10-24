import {
  coachedConversation,
  firstAnswer,
  readyWithoutTip,
  readyWithTip,
  secondAnswer,
  withCoaching,
} from '../data/coaching';
import { openingQuestion } from '../data/sessions';
import { wrapupSummary } from '../data/wrapup';
import { expect, test } from '../fixtures';
import { SPOKEN_SECOND_TRY } from '../fixtures/tauri/coaching';

test('Talk marks each answer quietly and never expands a note', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  const { session, dialogue } = coachedConversation([
    readyWithTip,
    readyWithoutTip,
    { state: 'pending' },
    { state: 'failed' },
  ]);
  tauri.session.withOpenSession(session, dialogue);
  await app.open();
  await start.continueSession();

  await expect(talk.learnerMessages).toHaveCount(4);
  await expect(app.exactText('1 tip')).toBeVisible();
  await expect(app.exactText('Looks good')).toBeVisible();
  await expect(talk.beingChecked).toHaveCount(1);
  await expect(app.text('More natural')).toHaveCount(0);
  await expect(app.text('Checking your answer…')).toHaveCount(0);
  await expect(app.text('Say it again')).toHaveCount(0);
});

test('the marker appearing does not change the height of the message', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  const { session, dialogue } = coachedConversation([{ state: 'pending' }, { state: 'pending' }]);
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  await app.open();
  await start.continueSession();
  await expect(talk.beingChecked).toHaveCount(2);
  const before = await talk.learnerMessages.nth(1).boundingBox();

  await tauri.coaching.land(withCoaching(dialogue, [readyWithTip, readyWithoutTip]));
  await expect(app.exactText('1 tip')).toBeVisible();
  const after = await talk.learnerMessages.nth(1).boundingBox();

  expect(after?.height).toBe(before?.height);
});

test('wrap-up shows every turn with a review per answer that fills in when coaching lands', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = coachedConversation([readyWithTip, { state: 'pending' }]);
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'ready' }, [], 1));
  await app.open();
  await start.continueSession();
  await talk.finish();
  await expect(wrapup.heading).toBeVisible();

  await expect(wrapup.conversation).toContainText(openingQuestion);
  await expect(wrapup.conversation).toContainText(firstAnswer);
  await expect(wrapup.conversation).toContainText('Reply number 1.');
  await expect(wrapup.review(1)).toContainText('I work there as an engineer.');
  await expect(wrapup.review(1)).toContainText('Drop the extra preposition after work.');
  await expect(wrapup.review(1).locator('mark').first()).toBeVisible();
  await expect(wrapup.review(1).getByRole('button', { name: 'Hear it' })).toBeVisible();
  await expect(wrapup.review(2)).toContainText('Checking your answer…');
  await expect(wrapup.conversation).toContainText(secondAnswer);

  await tauri.coaching.land(withCoaching(dialogue, [readyWithTip, readyWithoutTip]), {
    pending_coaching: 0,
  });
  await expect(wrapup.review(2)).toContainText('It keeps my plans in one place.');
  await expect(wrapup.review(2)).not.toContainText('Checking your answer…');
});

test('a failed answer can be checked again from the wrap-up', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = coachedConversation([{ state: 'failed' }]);
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'ready' }, [], 0));
  await app.open();
  await start.continueSession();
  await talk.finish();
  await expect(wrapup.review(1)).toContainText('Couldn’t check this answer.');

  await wrapup.review(1).getByRole('button', { name: 'Retry' }).click();
  await expect(wrapup.review(1)).toContainText('Checking your answer…');
  expect(await tauri.calls('retry_answer_coaching')).toEqual([
    expect.objectContaining({ args: { sessionId: 41, sequence: 1 } }),
  ]);
});

test('Say it again on the wrap-up records, transcribes and shows the comparison', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = coachedConversation([readyWithTip]);
  tauri.coaching.available();
  tauri.speech.grantMicrophone();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'ready' }, [], 0));
  await app.open();
  await start.continueSession();
  await talk.finish();
  await expect(wrapup.review(1)).toContainText('I work there as an engineer.');

  await wrapup.sayItAgain(1);
  await wrapup.stopRecording(1);

  await expect(wrapup.review(1)).toContainText('Second try');
  await expect(wrapup.review(1)).toContainText(SPOKEN_SECOND_TRY);
  await expect(wrapup.review(1)).toContainText('You used “I work there”');
  expect(await tauri.calls('retry_practice_turn')).toEqual([
    expect.objectContaining({
      args: { sessionId: 41, sequence: 1, transcript: SPOKEN_SECOND_TRY },
    }),
  ]);
});
