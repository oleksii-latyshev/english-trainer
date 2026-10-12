import { expect, test } from '../fixtures';
import type { App } from '../pages/app';
import type { ReviewPage } from '../pages/review-page';

const LIVE_PARTIAL_WAIT = { timeout: 10_000 };
const PARTIAL_TICK_QUIET_MS = 1800;
const PROVISIONAL = 'A provisional suggestion';
const FINAL_TRANSCRIPT = 'We can find a compromise.';

async function openAndRecord(app: App, review: ReviewPage) {
  await app.open();
  await app.sidebar.openMemory();
  await review.reviewNow();
  await review.recorder.start();
  await expect(review.recorder.finishAnswerButton).toBeVisible();
}

test('opening Memory review prewarms a cold speech engine for the first live answer', async ({
  app,
  review,
  tauri,
}) => {
  tauri.liveReview.withColdEngine();
  await openAndRecord(app, review);
  await expect(review.recorder.liveTranscript).toContainText(PROVISIONAL, LIVE_PARTIAL_WAIT);
  expect(await tauri.liveReview.warmCalls()).toBeGreaterThan(0);
  expect(await tauri.liveReview.submitted()).toEqual([]);
});

test('live review shows provisional words but saves only the final transcript, including shadowing', async ({
  app,
  review,
  tauri,
}) => {
  tauri.liveReview.withLiveTranscript();
  await openAndRecord(app, review);
  const bubble = review.recorder.liveTranscript;
  await expect(bubble).toContainText(PROVISIONAL, LIVE_PARTIAL_WAIT);
  expect(await tauri.liveReview.submitted()).toEqual([]);
  await review.recorder.finishAnswer();
  await expect(review.modelAnswer).toBeVisible();
  await expect(bubble).toHaveCount(0);
  expect(await tauri.liveReview.submitted()).toEqual([FINAL_TRANSCRIPT]);

  await review.shadow();
  await expect(bubble).toContainText(PROVISIONAL, LIVE_PARTIAL_WAIT);
  await review.recorder.finishAnswer();
  await expect(review.finishButton).toBeVisible();
  await expect(bubble).toHaveCount(0);
  expect(await tauri.liveReview.submitted()).toHaveLength(1);
  expect(await tauri.liveReview.finalCalls()).toBe(2);
});

for (const unavailable of [true, false]) {
  test(`final review answer survives ${unavailable ? 'unavailable' : 'failing'} live recognition`, async ({
    app,
    review,
    tauri,
  }) => {
    if (unavailable) tauri.liveReview.withLiveTranscriptUnavailable();
    else tauri.liveReview.failingPartials();
    await openAndRecord(app, review);
    if (unavailable) {
      await app.waitForQuietPeriod(PARTIAL_TICK_QUIET_MS);
      expect(await tauri.liveReview.partialCalls()).toBe(0);
    } else {
      await expect.poll(() => tauri.liveReview.partialCalls()).toBeGreaterThan(0);
    }
    await expect(review.recorder.liveTranscript).toHaveCount(0);
    await review.recorder.finishAnswer();
    await expect(review.modelAnswer).toBeVisible();
    expect(await tauri.liveReview.submitted()).toEqual([FINAL_TRANSCRIPT]);
  });
}

test('late partial after cancellation cannot enter a new recording or score an answer', async ({
  app,
  review,
  tauri,
}) => {
  tauri.liveReview.holdingPartial();
  await openAndRecord(app, review);
  await expect.poll(() => tauri.liveReview.partialCalls(), LIVE_PARTIAL_WAIT).toBe(1);
  await app.pressEscape();
  await expect(review.recorder.startButton).toBeVisible();
  await review.recorder.start();
  await expect(review.recorder.finishAnswerButton).toBeVisible();
  await tauri.liveReview.releasePartial();
  await expect(review.lateProvisional).toHaveCount(0);
  await expect(review.recorder.liveTranscript).toContainText(PROVISIONAL, LIVE_PARTIAL_WAIT);
  expect(await tauri.liveReview.submitted()).toEqual([]);
  await review.endReviewButton.click();
  const calls = await tauri.liveReview.partialCalls();
  await app.waitForQuietPeriod(PARTIAL_TICK_QUIET_MS);
  expect(await tauri.liveReview.partialCalls()).toBe(calls);
});

test('a cancelled capture ignores late engine readiness and silent capture sends no partials', async ({
  app,
  review,
  tauri,
}) => {
  tauri.liveReview.holdingEngineStatus().withSilentAudio();
  await openAndRecord(app, review);
  await app.pressEscape();
  await expect(review.recorder.startButton).toBeVisible();
  await tauri.liveReview.releaseEngineStatus();
  await app.waitForQuietPeriod(PARTIAL_TICK_QUIET_MS);
  expect(await tauri.liveReview.partialCalls()).toBe(0);
  await review.recorder.start();
  await expect(review.recorder.finishAnswerButton).toBeVisible();
  await app.waitForQuietPeriod(PARTIAL_TICK_QUIET_MS);
  expect(await tauri.liveReview.partialCalls()).toBe(0);
  await review.recorder.finishAnswer();
  await expect(review.modelAnswer).toBeVisible();
  expect(await tauri.liveReview.finalCalls()).toBe(1);
});

test('warmup can finish while a partial is pending and ignores it after the final answer', async ({
  app,
  start,
  review,
  tauri,
}) => {
  tauri.liveReview.holdingPartial();
  await app.open();
  await start.chooseWarmupFirst();
  await start.start();
  await review.recorder.start();
  await expect.poll(() => tauri.liveReview.partialCalls(), LIVE_PARTIAL_WAIT).toBe(1);
  await app.waitForQuietPeriod(PARTIAL_TICK_QUIET_MS);
  expect(await tauri.liveReview.partialCalls()).toBe(1);
  await review.recorder.finishAnswer();
  await expect(review.modelAnswer).toBeVisible();
  await tauri.liveReview.releasePartial();
  await expect(review.lateProvisional).toHaveCount(0);
  await expect(review.recorder.liveTranscript).toHaveCount(0);
  expect(await tauri.liveReview.submitted()).toEqual([FINAL_TRANSCRIPT]);
});
