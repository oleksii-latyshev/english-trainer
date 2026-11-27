import { debriefConversation, forTwoYears, getPaid, organised } from '../data/debrief';
import { wrapupSummary } from '../data/wrapup';
import { expect, test } from '../fixtures';

test('the Debrief steps through each answer with its findings and words to take', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = debriefConversation();
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();
  await start.continueSession();
  await talk.finish();
  await expect(wrapup.heading).toBeVisible();

  await expect(wrapup.progress).toHaveText('1 / 3');
  await expect(wrapup.debrief).toContainText('I work in there since two years.');
  await expect(wrapup.review(1)).toContainText('I have worked there for two years.');
  await expect(wrapup.review(1).locator('mark').first()).toBeVisible();
  await expect(wrapup.review(1)).toContainText('Drop the extra preposition after work.');
  await expect(wrapup.review(1)).toContainText('Fix');
  await expect(wrapup.review(1)).toContainText('for two years');
  await expect(wrapup.review(1).getByRole('button', { name: 'Hear it' })).toBeVisible();
  await expect(wrapup.review(1).getByRole('button', { name: 'Say it again' })).toBeVisible();
  await expect(wrapup.debrief.getByRole('button', { name: 'Back' })).toBeDisabled();

  await wrapup.next();
  await expect(wrapup.progress).toHaveText('2 / 3');
  await expect(wrapup.review(2)).toContainText('Better');
  await expect(wrapup.review(2)).toContainText('Organised is the natural word');

  await wrapup.next();
  await expect(wrapup.progress).toHaveText('3 / 3');
  await expect(wrapup.review(3)).toContainText('Missing word');
  await expect(wrapup.review(3)).toContainText('put on a short list of final choices');

  await wrapup.back();
  await expect(wrapup.progress).toHaveText('2 / 3');
});

test('taking a word saves it to Memory with its answer and the summary lists it', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = debriefConversation();
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();
  await start.continueSession();
  await talk.finish();

  await expect(wrapup.debrief).toContainText('0 of 5 taken');
  await wrapup.take(forTwoYears.phrase).click();
  await expect(wrapup.taken(forTwoYears.phrase)).toBeDisabled();
  await expect(wrapup.debrief).toContainText('1 of 5 taken');
  expect(await tauri.calls('save_phrase_card')).toEqual([
    expect.objectContaining({
      args: {
        phrase: 'for two years',
        meaning_or_note: forTwoYears.meaning,
        session_id: 41,
        sequence: 1,
      },
    }),
  ]);

  await wrapup.undo();
  await expect.poll(() => tauri.wrapup.deletedPhraseIds()).toEqual([500]);
  await expect(wrapup.take(forTwoYears.phrase)).toBeEnabled();

  await wrapup.take(getPaid.phrase).click();
  await expect(wrapup.taken(getPaid.phrase)).toBeVisible();
  await wrapup.next();
  await wrapup.next();
  await wrapup.next();
  await expect(wrapup.summary).toContainText('1 of 5 taken');
  await expect(wrapup.summary).toContainText(getPaid.phrase);
  await expect(wrapup.summary).not.toContainText(organised.phrase);
  await wrapup.back();
  await expect(wrapup.progress).toHaveText('3 / 3');
});

test('only the five words Rust offered can be taken and the count says when all are', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const offered = debriefConversation();
  const { session, dialogue } = {
    session: offered.session,
    dialogue: {
      ...offered.dialogue,
      debrief_words: offered.dialogue.debrief_words.filter((word) => word.phrase !== 'in one go'),
    },
  };
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();
  await start.continueSession();
  await talk.finish();

  await wrapup.next();
  await expect(wrapup.review(2)).toContainText('in one go');
  await expect(wrapup.take('in one go')).toHaveCount(0);
  await expect(wrapup.take(organised.phrase)).toBeVisible();

  await wrapup.take(organised.phrase).click();
  await wrapup.back();
  await wrapup.take(forTwoYears.phrase).click();
  await wrapup.take(getPaid.phrase).click();
  await wrapup.next();
  await wrapup.next();
  await wrapup.take('shortlisted').click();
  await expect(wrapup.debrief).toContainText('4 of 4 taken');
});

test('the five-word cap reads 5 of 5 taken when every offered word is taken', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = debriefConversation();
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();
  await start.continueSession();
  await talk.finish();

  await wrapup.take('for two years').click();
  await wrapup.take('get paid').click();
  await wrapup.next();
  await wrapup.take('organised').click();
  await wrapup.take('in one go').click();
  await wrapup.next();
  await wrapup.take('shortlisted').click();

  await expect(wrapup.debrief).toContainText('5 of 5 taken');
});

test('Say it again checks the words to take and the corrected fragments of the whole better version', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = debriefConversation();
  tauri.coaching.available().speaking('I have worked there for two years.');
  tauri.speech.grantMicrophone();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'ready' }, [], 0));
  await app.open();
  await start.continueSession();
  await talk.finish();

  await wrapup.sayItAgain(1);
  await wrapup.stopRecording(1);

  const review = wrapup.review(1);
  await expect(review).toContainText('Second try');
  await expect(review.getByText('for two years said', { exact: true })).toBeVisible();
  await expect(review.getByText('get paid not said yet', { exact: true })).toBeVisible();
  await expect(review.getByText('I work there not said yet', { exact: true })).toBeVisible();
  expect(await tauri.calls('retry_practice_turn')).toEqual([
    expect.objectContaining({
      args: { sessionId: 41, sequence: 1, transcript: 'I have worked there for two years.' },
    }),
  ]);
  await expect(wrapup.take(forTwoYears.phrase)).toBeVisible();
});
