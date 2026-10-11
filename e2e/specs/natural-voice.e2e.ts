import { fakeFollowUp, fakeReply, initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { NaturalVoiceBackend } from '../fixtures/tauri/natural-voice';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

const DISCARD_WINDOW_MS = 450;

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
  tauri.naturalVoice.delayingBy(350);
  await sendTypedAnswer({ app, start, talk, tauri });
  await expect.poll(async () => (await tauri.naturalVoice.state()).requests.length).toBe(1);
  await app.pressEscape();
  await app.waitForQuietPeriod(DISCARD_WINDOW_MS);
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

test('voice and speed choices persist and the preview uses them', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.naturalVoice.available();
  await app.open();
  await app.sidebar.openSettings();
  await settings.chooseVoice('natural:5');
  await settings.chooseSpeed('1.1×');
  await settings.preview();
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(1);
  expect((await tauri.naturalVoice.state()).requests[0]).toMatchObject({ voice_id: 5, speed: 1.1 });
  await app.reload();
  await app.sidebar.openSettings();
  await expect(settings.voice).toHaveValue('natural:5');
  await expect(settings.speed('1.1×')).toHaveAttribute('aria-pressed', 'true');
});

test('a transient generation failure rewarms in the background and later previews return to local speech', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.naturalVoice.failingOnce();
  await app.open();
  await app.sidebar.openSettings();
  await settings.preview();
  await expect
    .poll(async () => (await tauri.naturalVoice.state()).prewarms)
    .toBeGreaterThanOrEqual(2);
  await expect(settings.voice).toHaveValue('natural:0');
  await expect(settings.previewButton).toBeEnabled();
  expect((await tauri.naturalVoice.state()).played).toBe(0);
  await settings.preview();
  await expect.poll(async () => (await tauri.naturalVoice.state()).played).toBe(1);
});
