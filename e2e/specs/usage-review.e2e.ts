import { finalHeardAnswer } from '../data/rescue';
import { initialSession, writtenAnswer } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import { USAGE_TARGET } from '../fixtures/tauri/usage-review';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

async function begin({ app, start, tauri }: Omit<Scene, 'talk'>) {
  tauri.session.withOpenSession(initialSession);
  tauri.rescue.available();
  tauri.streaming.withWarmMicrophone();
  tauri.usageReview.available();
  await app.open();
  await start.continueSession();
}

async function speakAnswer(talk: TalkPage) {
  await talk.recorder.startAndWaitForSignal();
  await talk.recorder.stopAndReview();
  await expect(talk.recorder.heardField).toHaveValue(finalHeardAnswer);
  await talk.composer.send();
}

test('a spoken answer offers the learning use review and shows what it found', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await begin({ app, start, tauri });
  await speakAnswer(talk);

  await expect(talk.reply).toBeVisible();
  await expect(talk.usageReview.card).toBeVisible();
  await talk.usageReview.check();
  await expect(talk.usageReview.card).toContainText(`Target: “${USAGE_TARGET}”`);
  await expect(talk.usageReview.card).toContainText('Correct use credited');
  expect(await tauri.calls('review_practice_memory_usage')).toEqual([
    expect.objectContaining({ args: { session_id: 41, sequence: 1 } }),
  ]);
});

test('a typed answer is not offered a learning use review', async ({ app, start, talk, tauri }) => {
  await begin({ app, start, tauri });
  await talk.composer.typeInsteadAndSend(writtenAnswer);

  await expect(talk.reply).toBeVisible();
  await expect(talk.usageReview.card).toHaveCount(0);
});
