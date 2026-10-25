import {
  nextPlannedExample,
  planFailureMessage,
  plannedAnswer,
  plannedExample,
} from '../data/planner';
import { initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

async function openConversation({ app, start, tauri }: Omit<Scene, 'talk'>) {
  tauri.session.withOpenSession(initialSession);
  await app.open();
  await start.continueSession();
}

async function openWithWarmMicrophone(scene: Omit<Scene, 'talk'>) {
  scene.tauri.streaming.withWarmMicrophone();
  await openConversation(scene);
}

test('prefetch stays hidden and opens graduated cached help without another provider request', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await openWithWarmMicrophone({ app, start, tauri });
  const { planner } = talk;
  await expect.poll(async () => (await tauri.planner.state()).completed).toBe(1);
  expect((await tauri.planner.state()).cueWrites).toBe(0);
  await expect(planner.content(plannedExample)).toHaveCount(0);
  await planner.frameButton.click();
  await expect(planner.content('Name the tool')).toBeVisible();
  await expect(planner.content('One tool I use is')).toHaveCount(0);
  await planner.phrasesButton.click();
  await expect(planner.content('One tool I use is')).toBeVisible();
  await expect(planner.content(plannedExample)).toHaveCount(0);
  await planner.exampleButton.click();
  await expect(planner.content(plannedExample)).toBeVisible();
  expect((await tauri.planner.state()).requested).toBe(1);
  await planner.hideButton.click();
  await expect(planner.content(plannedExample)).toHaveCount(0);
  await talk.composer.typeInsteadAndSend(plannedAnswer);
  await expect.poll(async () => (await tauri.session.dialogue())?.help_used).toEqual([true]);
});

test('H and the number keys open, switch and close help levels', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await openWithWarmMicrophone({ app, start, tauri });
  const { planner } = talk;
  await expect.poll(async () => (await tauri.planner.state()).completed).toBe(1);
  await planner.pressKey('h');
  await expect(planner.content('Name the tool')).toBeVisible();
  await planner.pressKey('2');
  await expect(planner.content('One tool I use is')).toBeVisible();
  await planner.pressKey('3');
  await expect(planner.content(plannedExample)).toBeVisible();
  await planner.pressKey('3');
  await expect(planner.content(plannedExample)).toHaveCount(0);
  await planner.pressKey('h');
  await expect(planner.content('Name the tool')).toBeVisible();
  await planner.pressKey('h');
  await expect(planner.content('Name the tool')).toHaveCount(0);
});

test('a failed plan can be retried while the answer composer stays usable', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.planner.failingFirstPlan();
  await openWithWarmMicrophone({ app, start, tauri });
  const { planner } = talk;
  await planner.frameButton.click();
  await expect(planner.content(planFailureMessage)).toBeVisible();
  await expect(talk.recorder.startButton).toBeEnabled();
  await planner.retryButton.click();
  await expect(planner.content('Name the tool')).toBeVisible();
  expect((await tauri.planner.state()).requested).toBe(2);
  expect((await tauri.calls('prefetch_answer_plan')).slice(-1)[0]?.args.retry).toBe(true);
});

test('help is not exposed until its cue write succeeds', async ({ app, start, talk, tauri }) => {
  tauri.planner.failingFirstCue();
  await openWithWarmMicrophone({ app, start, tauri });
  const { planner } = talk;
  await planner.frameButton.click();
  await expect(planner.content('Name the tool')).toHaveCount(0);
  await expect(planner.cueFailure).toBeVisible();
  await planner.frameButton.click();
  await expect(planner.content('Name the tool')).toBeVisible();
  expect((await tauri.planner.state()).cueWrites).toBe(2);
});

test('a late plan for the previous question cannot replace the current example', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.planner.delayingFirstPlanBy(1500);
  await openWithWarmMicrophone({ app, start, tauri });
  const { planner } = talk;
  await talk.composer.typeInsteadAndSend(plannedAnswer);
  await expect.poll(async () => (await tauri.planner.state()).requested).toBe(2);
  await planner.exampleButton.click();
  await expect(planner.content(nextPlannedExample)).toBeVisible();
  await expect.poll(async () => (await tauri.planner.state()).completed).toBe(2);
  await expect(planner.content(plannedExample)).toHaveCount(0);
  await expect(planner.content(nextPlannedExample)).toBeVisible();
  expect((await tauri.session.dialogue())?.help_used).toEqual([false]);
});

test('planning timers end quietly and manual recording cancels them', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await openWithWarmMicrophone({ app, start, tauri });
  const { planner } = talk;
  await app.useFakeClock();
  await planner.frameButton.click();
  await planner.planFor(15);
  await expect(planner.planningTime(15)).toBeVisible();
  await app.advanceClock(15000);
  await expect(planner.cancelPlanningButton).toHaveCount(0);
  await expect(talk.listeningAny).toHaveCount(0);
  await planner.planFor(30);
  await talk.recorder.start();
  await expect(planner.cancelPlanningButton).toHaveCount(0);
  await expect(talk.listeningAny).toBeVisible();
});

test('a planning timer suppresses automatic capture after Eva finishes speaking', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.withWarmMicrophone().holdingVoice();
  await openConversation({ app, start, tauri });
  const { planner } = talk;
  await talk.turnOnAutoListen();
  await talk.composer.typeInsteadAndSend(plannedAnswer);
  await expect.poll(() => tauri.streaming.providerFinished()).toBe(true);
  await planner.frameButton.click();
  await planner.planFor(15);
  await tauri.streaming.finishSpeech();
  await expect.poll(async () => (await tauri.streaming.spoken()).length).toBe(2);
  await tauri.streaming.finishSpeech();
  await expect(planner.planningTime(15)).toBeVisible();
  await expect(talk.listeningAny).toHaveCount(0);
  await talk.recorder.start();
  await expect(talk.listeningAny).toBeVisible();
  await expect(planner.cancelPlanningButton).toHaveCount(0);
});

for (const firstCueDelayMs of [0, 800]) {
  test(`automatic capture hides Example even with a ${firstCueDelayMs}ms cue acknowledgment`, async ({
    app,
    start,
    talk,
    tauri,
  }) => {
    tauri.planner.delayingFirstCueBy(firstCueDelayMs);
    tauri.streaming.withWarmMicrophone().holdingVoice();
    await openConversation({ app, start, tauri });
    const { planner } = talk;
    await talk.turnOnAutoListen();
    await talk.composer.typeInsteadAndSend(plannedAnswer);
    await expect.poll(() => tauri.streaming.providerFinished()).toBe(true);
    await planner.exampleButton.click();
    if (firstCueDelayMs === 0) await expect(planner.content(nextPlannedExample)).toBeVisible();
    await tauri.streaming.finishSpeech();
    await expect.poll(async () => (await tauri.streaming.spoken()).length).toBe(2);
    await tauri.streaming.finishSpeech();
    await expect(talk.listeningAny).toBeVisible();
    await expect.poll(async () => (await tauri.planner.state()).cueAcknowledged).toBe(1);
    await expect(planner.content(nextPlannedExample)).toHaveCount(0);
  });
}
