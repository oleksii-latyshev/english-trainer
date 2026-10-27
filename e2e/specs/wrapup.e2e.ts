import { coachedConversation, readyWithTip } from '../data/coaching';
import { phraseSet, wrapupSummary } from '../data/wrapup';
import { expect, test } from '../fixtures';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';
import type { WrapupPage } from '../pages/wrapup-page';

async function finishSession(app: App, start: StartPage, talk: TalkPage, wrapup: WrapupPage) {
  await app.open();
  await app.sidebar.openSpeak();
  await start.start();
  await talk.finish();
  await expect(wrapup.heading).toBeVisible();
}

test('finishing stays usable while phrase generation and coaching are pending', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'pending' }, [], 1));
  await finishSession(app, start, talk, wrapup);

  await expect(wrapup.preparingPhrases).toBeVisible();
  await expect(wrapup.pendingCoaching).toBeVisible();
  await expect(wrapup.speakingTimeLabel).toBeVisible();
  await expect(wrapup.noSpokenAnswers).toBeVisible();
  await wrapup.done();
  await expect(start.heading).toBeVisible();
});

test('ready phrase cards show the usage note and exact learner quote', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'pending' }, [], 1));
  await finishSession(app, start, talk, wrapup);
  await tauri.wrapup.completePreparation({
    phrases: phraseSet.slice(0, 1),
    pending_coaching: 1,
    wrapup_preparation: { state: 'ready' },
  });

  await expect(wrapup.phrase('It saves me time.')).toBeVisible();
  await expect(wrapup.usageNote('Use this to explain a practical benefit.')).toBeVisible();
  await expect(wrapup.learnerQuote('It make my work faster.')).toBeVisible();
  await expect(wrapup.pendingCoaching).toBeVisible();
});

test('failed phrase preparation retries and accepts the later ready event', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.wrapup
    .finishingWith(
      wrapupSummary(
        {
          state: 'failed',
          error: { code: 'timeout', message: 'Phrase service timed out. Try again.' },
        },
        [],
      ),
    )
    .recoveringWith(wrapupSummary({ state: 'ready' }, phraseSet.slice(0, 1)));
  await finishSession(app, start, talk, wrapup);

  await expect(app.alert).toContainText('Phrase service timed out. Try again.');
  await wrapup.retryPhrases();
  await expect(wrapup.phrase('It saves me time.')).toBeVisible();
  expect(await tauri.calls()).toContainEqual(
    expect.objectContaining({ command: 'retry_session_wrapup', args: { sessionId: 41 } }),
  );
});

test('wrap-up events for another session do not replace the visible session', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'pending' }, [], 1));
  await finishSession(app, start, talk, wrapup);
  await tauri.wrapup.completePreparation({
    session_id: 99,
    phrases: phraseSet.slice(0, 1),
    wrapup_preparation: { state: 'ready' },
  });

  await expect(wrapup.preparingPhrases).toBeVisible();
  await expect(wrapup.phrase('It saves me time.')).toHaveCount(0);
});

test('save all is atomic, removed phrases stay out, duplicates are not undone', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const existing = {
    id: 321,
    phrase: phraseSet[0].phrase,
    kind: 'phrase' as const,
    normalized_phrase: phraseSet[0].phrase.toLowerCase(),
    meaning_or_note: 'Already remembered.',
    session_id: null,
    sequence: null,
    created_at: 1,
    last_reviewed_at: null,
    next_review_at: 2,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'new' as const,
    is_due: true,
    times_used_on_own: 0,
  };
  tauri.wrapup
    .finishingWith(wrapupSummary({ state: 'ready' }, phraseSet))
    .withExistingCards([existing]);
  await finishSession(app, start, talk, wrapup);
  await wrapup.removePhrase('I tend to plan ahead.');
  const memoryReads = (await tauri.calls('get_learning_memory')).length;
  await wrapup.saveAll(2);
  await expect(wrapup.savedButton).toBeVisible();
  await expect
    .poll(async () => (await tauri.calls('get_learning_memory')).length)
    .toBeGreaterThan(memoryReads);
  const [savedCall] = await tauri.calls('save_wrapup_phrases');
  expect(savedCall?.args).toEqual({
    sessionId: 41,
    phrases: [phraseSet[0].phrase, phraseSet[2].phrase],
  });
  await wrapup.undo();
  await expect.poll(() => tauri.wrapup.deletedPhraseIds()).toEqual([500]);
  await expect(wrapup.phrase('It saves me time.')).toBeVisible();
  expect(await tauri.wrapup.deletedPhraseIds()).not.toContain(321);
});

test('ready empty wrap-up has its own message while coaching is still pending', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'ready' }, [], 1));
  await finishSession(app, start, talk, wrapup);

  await expect(wrapup.noPhrases).toBeVisible();
  await expect(wrapup.pendingCoaching).toBeVisible();
});

test('an answer’s better version is saved from its review and can be undone', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = coachedConversation([readyWithTip]);
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary({ state: 'ready' }, [], 0));
  await app.open();
  await start.continueSession();
  await talk.finish();
  await expect(wrapup.review(1)).toContainText('I work there as an engineer.');

  await wrapup.saveAnswerPhrase(1);
  await expect(wrapup.answerSaved(1)).toBeVisible();
  expect(await tauri.calls('save_phrase_card')).toEqual([
    expect.objectContaining({
      args: {
        phrase: 'I work there',
        meaning_or_note: 'Drop the extra preposition after work.',
        session_id: 41,
        sequence: 1,
      },
    }),
  ]);

  await wrapup.undo();
  await expect.poll(() => tauri.wrapup.deletedPhraseIds()).toEqual([500]);
  await expect(wrapup.review(1).getByRole('button', { name: 'Save phrase' })).toBeVisible();
});
