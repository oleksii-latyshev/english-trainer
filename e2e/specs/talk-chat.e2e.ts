import { longConversation } from '../data/builders';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

const READABLE_MIN_HEIGHT_PX = 200;
const LONG_HISTORY_TURNS = 14;

async function openLongConversation({ app, start, tauri }: Omit<Scene, 'talk'>) {
  const { session, dialogue } = longConversation(LONG_HISTORY_TURNS);
  tauri.session.withOpenSession(session, dialogue);
  await app.open();
  await start.continueSession();
}

test('the chat follows the streaming reply, pauses when the learner scrolls up and jumps back', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.holdingProvider().withWarmMicrophone();
  await openLongConversation({ app, start, tauri });
  await expect.poll(() => talk.chat.distanceFromEnd()).toBeLessThan(24);
  await talk.composer.typeInsteadAndSend('A useful tool helps me plan.');
  await expect(talk.exactReply).toBeVisible();
  await expect.poll(() => talk.chat.distanceFromEnd()).toBeLessThan(24);
  await talk.chat.scrollToTop();
  await expect.poll(() => talk.chat.distanceFromEnd()).toBeGreaterThan(200);
  await tauri.streaming.finishProvider();
  await expect(talk.chat.newMessageButton).toBeVisible();
  expect(await talk.chat.distanceFromEnd()).toBeGreaterThan(200);
  await talk.chat.newMessageButton.click();
  await expect.poll(() => talk.chat.distanceFromEnd()).toBeLessThan(24);
  await expect(talk.chat.newMessageButton).toHaveCount(0);
});

test('answer help and the keyboard composer keep the history readable', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.streaming.withWarmMicrophone();
  await openLongConversation({ app, start, tauri });
  await talk.planner.exampleButton.click();
  await talk.composer.typeInstead();
  await expect(talk.composer.answer).toBeFocused();
  await talk.composer.write('I use a notebook');
  await expect(talk.chat.history).toBeVisible();
  expect(await talk.chat.height()).toBeGreaterThanOrEqual(READABLE_MIN_HEIGHT_PX);
  await expect(talk.chat.history.getByText(/Earlier reply number 14/u)).toBeVisible();
});
