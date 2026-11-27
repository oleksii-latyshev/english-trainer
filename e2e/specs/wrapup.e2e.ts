import { wrapupSummary } from '../data/wrapup';
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

test('finishing stays usable while coaching is pending', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.wrapup.finishingWith(wrapupSummary(1));
  await finishSession(app, start, talk, wrapup);

  await expect(wrapup.pendingCoaching).toBeVisible();
  await expect(wrapup.speakingTimeLabel).toBeVisible();
  await expect(wrapup.noSpokenAnswers).toBeVisible();
  await wrapup.done();
  await expect(start.heading).toBeVisible();
});

test('the wrap-up no longer lists a separate set of phrases to save', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  tauri.wrapup.finishingWith(wrapupSummary());
  await finishSession(app, start, talk, wrapup);

  await expect(app.text('Phrases worth learning')).toHaveCount(0);
  await expect(app.text('Save all')).toHaveCount(0);
});
