import { fakeFollowUp, fakeReply, initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { NaturalVoiceBackend } from '../fixtures/tauri/natural-voice';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

const voiceSample = "Hi, I'm glad you picked my voice!";

async function sendTypedAnswer({ app, start, talk, tauri }: Scene, autoListen = false) {
  tauri.session.withOpenSession(initialSession);
  tauri.streaming.holdingProvider();
  if (autoListen) tauri.streaming.withWarmMicrophone();
  await app.open();
  await start.continueSession();
  if (autoListen) await talk.turnOnAutoListen();
  await talk.composer.typeInsteadAndSend('A useful tool helps me plan.');
}

test('local audio starts before provider finish, prefetches the next sentence, and listens only at final audio end', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.naturalVoice.available();
  await sendTypedAnswer({ app, start, talk, tauri }, true);
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(1);
  expect(await tauri.streaming.providerFinished()).toBe(false);
  await tauri.streaming.finishProvider();
  await expect
    .poll(async () => (await tauri.naturalVoice.state()).requests.map((request) => request.text))
    .toEqual([fakeReply, fakeFollowUp]);
  expect((await tauri.naturalVoice.state()).played).toBe(1);
  await expect(talk.listening).toHaveCount(0);
  await tauri.naturalVoice.finishAudio();
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(2);
  await expect(talk.listening).toHaveCount(0);
  await tauri.naturalVoice.finishAudio();
  await expect(talk.listening).toBeVisible();
  expect(await tauri.streaming.spoken()).toEqual([]);
});

test('late generated audio is discarded after an interruption', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.naturalVoice.holdingGeneration().interruptedOnRequest();
  await sendTypedAnswer({ app, start, talk, tauri });
  await expect.poll(async () => (await tauri.naturalVoice.state()).requests.length).toBe(1);
  await tauri.naturalVoice.releaseGeneration();
  await expect.poll(async () => (await tauri.naturalVoice.state()).settled).toBe(1);
  await app.settleRendering();
  expect((await tauri.naturalVoice.state()).played).toBe(0);
  expect(await tauri.streaming.spoken()).toEqual([]);
});

const fallbacks: [string, (voice: NaturalVoiceBackend) => NaturalVoiceBackend][] = [
  ['missing local model', (voice) => voice.notReady()],
  ['generation error', (voice) => voice.failing()],
  ['slow generation', (voice) => voice.delayingBy(1200)],
  ['media failure before playback', (voice) => voice.failingMediaPlayback()],
];

for (const [name, configure] of fallbacks) {
  test(`${name} falls back to system speech without replaying the answer`, async ({
    app,
    start,
    talk,
    tauri,
  }) => {
    configure(tauri.naturalVoice);
    await sendTypedAnswer({ app, start, talk, tauri });
    await expect.poll(() => tauri.streaming.spoken()).toEqual([fakeReply]);
    await tauri.streaming.finishProvider();
    await expect.poll(() => tauri.streaming.spoken()).toEqual([fakeReply, fakeFollowUp]);
    expect((await tauri.naturalVoice.state()).played).toBe(0);
  });
}

test('choosing a voice saves it and plays the sample, speed persists and the sample replays', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.naturalVoice.available();
  await app.open();
  await app.sidebar.openSettings();
  await settings.chooseVoice('Male 1');
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(1);
  expect((await tauri.naturalVoice.state()).requests[0]).toEqual({
    text: voiceSample,
    voice_id: 5,
    speed: 1,
  });
  await tauri.naturalVoice.finishAudio();
  await settings.chooseSpeed('1.1×');
  await settings.playSample('Male 1');
  await expect.poll(async () => (await tauri.naturalVoice.state()).requests.length).toBe(2);
  expect((await tauri.naturalVoice.state()).requests[1]).toMatchObject({ voice_id: 5, speed: 1.1 });
  await app.reload();
  await app.sidebar.openSettings();
  await expect(settings.voice('Male 1')).toBeChecked();
  await expect(settings.speed('1.1×')).toHaveAttribute('aria-pressed', 'true');
});

test('every natural voice is listed with its gender and arrow keys choose one', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.naturalVoice.available();
  await app.open();
  await app.sidebar.openSettings();
  await expect(settings.voices.getByRole('radio')).toHaveCount(10);
  await expect(settings.voice('Female 5')).toContainText('Female voice');
  await expect(settings.voice('Male 5')).toContainText('Male voice');
  await settings.voice('Female 1').focus();
  await app.pressKey('ArrowDown');
  await expect(settings.voice('Female 2')).toBeChecked();
  await expect
    .poll(async () => (await tauri.naturalVoice.state()).requests[0])
    .toMatchObject({
      voice_id: 1,
    });
});

test('choosing another voice stops the sample that is playing', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.naturalVoice.available();
  await app.open();
  await app.sidebar.openSettings();
  await settings.chooseVoice('Male 1');
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(1);
  await settings.chooseVoice('Female 3');
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(2);
  expect((await tauri.naturalVoice.state()).stopped).toBe(1);
  expect((await tauri.naturalVoice.state()).requests.map((request) => request.voice_id)).toEqual([
    5, 2,
  ]);
});

test('a transient generation failure rewarms in the background and later samples return to local speech', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.naturalVoice.failingOnce();
  await app.open();
  await app.sidebar.openSettings();
  await settings.playSample('Female 1');
  await expect
    .poll(async () => (await tauri.naturalVoice.state()).prewarms)
    .toBeGreaterThanOrEqual(2);
  await expect(settings.voice('Female 1')).toBeChecked();
  await expect(settings.sampleButton('Female 1')).toBeEnabled();
  expect((await tauri.naturalVoice.state()).played).toBe(0);
  await settings.playSample('Female 1');
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(1);
});

test('settings offer the system voices when the local voice is unavailable', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.naturalVoice.notReady();
  await app.open();
  await app.sidebar.openSettings();
  await expect(settings.unavailableNotice).toBeVisible();
  await expect(settings.voices).toHaveCount(0);
});
