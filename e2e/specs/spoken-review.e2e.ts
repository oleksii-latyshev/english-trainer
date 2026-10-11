import { expect, test } from '../fixtures';
import type { App } from '../pages/app';
import type { ReviewPage } from '../pages/review-page';

async function openReview(app: App, review: ReviewPage) {
  await app.open();
  await app.sidebar.openMemory();
  await review.reviewNow();
}

test('generated situation is used and Show phrase waits for persisted reveal', async ({
  app,
  review,
  tauri,
}) => {
  tauri.review.withDuePhrase();
  await openReview(app, review);
  await expect(review.situation).toBeVisible();
  await expect(review.modelAnswer).toHaveCount(0);

  await review.showPhrase();
  await expect(review.revealedPhrase).toBeVisible();
  await expect(review.hintNotice).toBeVisible();
  expect(await tauri.review.calls()).toContain('reveal_review_phrase');
  expect((await tauri.review.materials()).items[0].is_cued).toBe(true);
});

test('a preparation failure can be retried without blocking review controls', async ({
  app,
  review,
  tauri,
}) => {
  tauri.review.failingPreparationOnce();
  await openReview(app, review);
  await expect(review.preparationFailure).toBeVisible();
  await expect(review.skipButton).toBeVisible();
  await review.retrySituations();
  await expect(review.situation).toBeVisible();
});

test('optional material IPC failure preserves retry and failed reveal shows no hint', async ({
  app,
  review,
  tauri,
}) => {
  tauri.review.throwingOnPreparation().failingReveal();
  await openReview(app, review);
  await expect(review.retrySituationsButton).toBeEnabled();
  await expect(review.cue).toBeVisible();
  await expect(review.skipButton).toBeEnabled();
  await review.showPhrase();
  await expect(review.revealFailure).toBeVisible();
  await expect(review.revealedPhrase).toHaveCount(0);
  expect((await tauri.review.materials()).items[0].is_cued).toBe(false);
});

test('changing from warmup-first to Text chat starts without review or microphone', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.review.withDuePhrase();
  await app.open();
  await start.chooseWarmupFirst();
  await start.chooseTextChat();
  await expect(start.warmupToggle).toHaveCount(0);
  await start.startTextChat();
  await expect(talk.openingQuestion).toBeVisible();
  expect(await tauri.review.calls()).toEqual([]);
  expect((await tauri.session.lastOptions())?.practice_mode).toBe('text_chat');
  expect((await tauri.speech.counts()).mediaRequests).toBe(0);
});

test('late situations stay out of an active recording and Shadow it never scores twice', async ({
  app,
  review,
  tauri,
}) => {
  tauri.review.holdingPreparation();
  await openReview(app, review);
  await expect(review.cue).toBeVisible();
  await review.recorder.start();
  await expect(review.recorder.finishAnswerButton).toBeVisible();
  await expect(review.recorder.replayButton).toBeDisabled();
  await review.recorder.waitForMicrophoneSignal();
  const { speechRequests } = await tauri.speech.counts();
  await tauri.review.completePreparation();
  await expect(review.situation).toHaveCount(0);
  expect((await tauri.speech.counts()).speechRequests).toBe(speechRequests);

  await review.recorder.finishAnswer();
  await expect(review.modelAnswer).toBeVisible();
  await expect(review.showPhraseButton).toHaveCount(0);
  await review.shadow();
  await expect(review.recorder.finishAnswerButton).toBeVisible();
  await review.recorder.waitForMicrophoneSignal();
  await review.recorder.finishAnswer();
  await expect(review.finishButton).toBeVisible();
  expect(
    (await tauri.review.calls()).filter((call) => call === 'submit_memory_recall'),
  ).toHaveLength(1);
});

test('warmup snapshots selected talk options and starts that conversation once on End', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.review.withDuePhrase();
  await app.open();
  await app.sidebar.openSpeak();
  await start.chooseWarmupFirst();
  await start.chooseFreeTopic();
  await start.describeTopic('A difficult team decision');
  await start.chooseLength(5);
  await start.start();
  await expect(start.skipWarmupButton).toBeVisible();

  await start.skipWarmup();
  await expect(talk.openingQuestion).toBeVisible();
  expect(await tauri.session.lastOptions()).toEqual({
    topic_id: 'free_topic',
    topic_custom: 'A difficult team decision',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
  });
  expect(await tauri.calls('start_practice_session')).toHaveLength(1);
  expect(await tauri.review.calls()).toContain('start_memory_review:true');
});

test('a resumed scored warmup waits for its finish write before starting talk', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.review.withCompletedRunAndDuePhrase().holdingInitialFinish();
  await app.open();
  await app.sidebar.openSpeak();
  await start.chooseWarmupFirst();
  await start.chooseFreeTopic();
  await start.describeTopic('A difficult team decision');
  await start.chooseLength(5);
  await start.start();

  await expect
    .poll(async () =>
      (await tauri.review.calls()).filter((call) => call === 'finish_memory_review'),
    )
    .toHaveLength(1);
  expect(await tauri.calls('start_practice_session')).toHaveLength(0);
  await tauri.review.completeFinish(false);
  await expect(start.retryFinishButton).toBeVisible();
  expect(await tauri.calls('start_practice_session')).toHaveLength(0);

  await start.retryFinish();
  await expect(talk.openingQuestion).toBeVisible();
  expect(await tauri.session.lastOptions()).toEqual({
    topic_id: 'free_topic',
    topic_custom: 'A difficult team decision',
    duration_goal_seconds: 300,
    practice_mode: 'voice',
  });
  expect(await tauri.calls('start_practice_session')).toHaveLength(1);
  expect(
    (await tauri.review.calls()).filter((call) => call === 'finish_memory_review'),
  ).toHaveLength(2);
});

test('empty warmup can be skipped into the saved conversation options', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.review.withEmptyWarmup();
  await app.open();
  await app.sidebar.openSpeak();
  await start.chooseWarmupFirst();
  await start.start();
  await expect(start.emptyWarmupHeading).toBeVisible();
  await start.skipWarmup();
  await expect(talk.openingQuestion).toBeVisible();
  expect(await tauri.calls('start_practice_session')).toHaveLength(1);
});
