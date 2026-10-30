import { longConversation } from '../data/builders';
import { expect, test } from '../fixtures';

const LAPTOP_14 = { width: 1512, height: 860 };
const LONG_HISTORY_TURNS = 14;
const LIVE_PARTIAL_WAIT = { timeout: 10_000 };
const PROVISIONAL = 'A provisional suggestion';

test.use({ viewport: LAPTOP_14 });

test('on a 14-inch screen the newest question and the live transcript stay readable, folded or not', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  const { session, dialogue } = longConversation(LONG_HISTORY_TURNS);
  tauri.session.withOpenSession(session, dialogue);
  tauri.rescue.available();
  tauri.liveReview.withLiveTranscript();
  await app.open();
  await start.continueSession();
  const newestQuestion = talk.chat.history.getByText(session.opening_question, { exact: true });
  await expect(newestQuestion).toBeVisible();
  const unfoldedHeight = await talk.chat.height();

  await talk.recorder.startAndWaitForSignal();
  const bubble = talk.chat.history.getByText(PROVISIONAL);
  await expect(bubble).toBeVisible(LIVE_PARTIAL_WAIT);
  await expect.poll(() => talk.chat.isFullyInView(bubble)).toBe(true);
  expect(await talk.chat.isFullyInView(newestQuestion)).toBe(true);

  await talk.foldEvaButton.click();
  await expect(talk.evaStage).toHaveCount(0);
  await expect(talk.unfoldEvaButton).toBeVisible();
  await expect.poll(() => talk.chat.height()).toBeGreaterThan(unfoldedHeight + 40);
  await expect.poll(() => talk.chat.isFullyInView(bubble)).toBe(true);
  await expect.poll(() => talk.chat.isFullyInView(newestQuestion)).toBe(true);
  expect(await talk.chat.distanceFromEnd()).toBeLessThan(24);
});

test('the folded choice shows Eva in the header, survives a reload and unfolds again', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  const { session, dialogue } = longConversation(3);
  tauri.session.withOpenSession(session, dialogue);
  await app.open();
  await start.continueSession();
  await expect(talk.evaStage).toBeVisible();

  await talk.foldEvaButton.click();
  await expect(talk.evaStage).toHaveCount(0);
  await expect(talk.foldedEvaStatus).toHaveText(/^Eva, /);

  await app.reload();
  await start.continueSession();
  await expect(talk.unfoldEvaButton).toBeVisible();
  await expect(talk.evaStage).toHaveCount(0);

  await talk.unfoldEvaButton.click();
  await expect(talk.evaStage).toBeVisible();
  await expect(talk.foldEvaButton).toBeVisible();
});
