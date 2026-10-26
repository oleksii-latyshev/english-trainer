import { fakeFollowUp, fakeReply, initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

const QUIET_AFTER_CANCEL_MS = 900;

async function sendTypedAnswer({ app, start, talk, tauri }: Scene, autoListen = false) {
  tauri.session.withOpenSession(initialSession);
  await app.open();
  await start.continueSession();
  if (autoListen) {
    await talk.turnOnAutoListen();
    await expect(talk.autoListenSwitch).toBeChecked();
  }
  await talk.composer.typeInsteadAndSend('A useful tool helps me plan.');
}

test('the first sentence speaks before provider completion and the question is spoken once', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.holdingProvider();
  await sendTypedAnswer({ app, start, talk, tauri });
  await expect.poll(() => tauri.streaming.spoken()).toEqual([fakeReply]);
  expect(await tauri.streaming.providerFinished()).toBe(false);
  await tauri.streaming.finishProvider();
  await expect.poll(() => tauri.streaming.spoken()).toEqual([fakeReply, fakeFollowUp]);
  await expect.poll(() => tauri.streaming.providerFinished()).toBe(true);
  expect(await tauri.streaming.firstSpeechToProviderFinishMs()).toBeGreaterThan(0);
  await talk.openTiming();
  await expect(talk.timingDialog).toContainText('Send to first audio');
});

test('an open stream gap does not auto-listen and completion fires only after the last utterance', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.holdingVoice().holdingProvider().withWarmMicrophone();
  await sendTypedAnswer({ app, start, talk, tauri }, true);
  await expect.poll(() => tauri.streaming.spoken()).toHaveLength(1);
  await expect.poll(async () => (await tauri.speech.counts()).mediaRequests).toBeGreaterThan(0);
  await expect(talk.microphoneStatus).toContainText('Microphone on');
  const initialMedia = (await tauri.speech.counts()).mediaRequests;
  await tauri.streaming.finishSpeech();
  await app.settleRendering();
  await expect(talk.listening).toHaveCount(0);
  expect((await tauri.speech.counts()).mediaRequests).toBe(initialMedia);
  await tauri.streaming.finishProvider();
  await expect.poll(() => tauri.streaming.spoken()).toHaveLength(2);
  await expect.poll(() => tauri.streaming.providerFinished()).toBe(true);
  await app.settleRendering();
  await expect(talk.listening).toHaveCount(0);
  expect((await tauri.speech.counts()).mediaRequests).toBe(initialMedia);
  await tauri.streaming.finishSpeech();
  await expect(talk.listening).toBeVisible();
  expect((await tauri.speech.counts()).mediaRequests).toBe(initialMedia);
});

test('a TTS failure keeps the saved reply visible and does not auto-listen', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.failingVoice().withWarmMicrophone();
  await sendTypedAnswer({ app, start, talk, tauri }, true);
  await expect(talk.exactReply).toBeVisible();
  await expect(talk.voiceFailureNotice).toBeVisible();
  await expect.poll(async () => (await tauri.session.dialogue())?.turns).toHaveLength(1);
  const { mediaRequests } = await tauri.speech.counts();
  await expect(talk.listening).toHaveCount(0);
  await app.waitForQuietPeriod(100);
  expect((await tauri.speech.counts()).mediaRequests).toBe(mediaRequests);
});

test('Escape cancels an in-flight reply and late chunks cannot revive speech or persist it', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.holdingVoice();
  await sendTypedAnswer({ app, start, talk, tauri });
  await expect.poll(() => tauri.streaming.spoken()).toHaveLength(1);
  await app.pressEscape();
  await expect.poll(async () => (await tauri.calls('cancel_practice_reply')).length).toBe(1);
  await app.waitForQuietPeriod(QUIET_AFTER_CANCEL_MS);
  expect(await tauri.streaming.spoken()).toEqual([fakeReply]);
  expect((await tauri.session.dialogue())?.turns).toHaveLength(0);
  await tauri.streaming.finishSpeech();
  expect(await tauri.streaming.spoken()).toHaveLength(1);
});

test('Speak anyway is enabled while Eva is thinking and interrupts before opening capture', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.withoutDeltas().holdingProvider();
  await sendTypedAnswer({ app, start, talk, tauri });
  await talk.speakAnyway();
  await expect.poll(async () => (await tauri.calls('cancel_practice_reply')).length).toBe(1);
  await app.waitForQuietPeriod(QUIET_AFTER_CANCEL_MS);
  expect(await tauri.streaming.spoken()).toEqual([]);
  expect((await tauri.session.dialogue())?.turns).toHaveLength(0);
});

test('a provider without deltas speaks the final reply once', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.withoutDeltas();
  await sendTypedAnswer({ app, start, talk, tauri });
  await expect.poll(() => tauri.streaming.spoken()).toEqual([`${fakeReply} ${fakeFollowUp}`]);
});

test('releasing Space during reply cancellation abandons the delayed recording', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming
    .withoutDeltas()
    .holdingProvider()
    .withWarmMicrophone()
    .cancelAcknowledgedAfter(200);
  await sendTypedAnswer({ app, start, talk, tauri });
  await talk.focusThinking();
  await talk.tapSpace();
  await expect.poll(async () => (await tauri.calls('cancel_practice_reply')).length).toBe(1);
  await expect(talk.recorder.startButton).toBeVisible();
  await expect(talk.listening).toHaveCount(0);
  expect((await tauri.session.dialogue())?.turns).toHaveLength(0);
  expect(await tauri.streaming.spoken()).toEqual([]);
});
