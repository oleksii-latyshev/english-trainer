import { finalHeardAnswer } from '../data/rescue';
import { initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

const DUE = [
  { phrase_id: 7, cue: 'A practical benefit' },
  { phrase_id: 8, cue: 'A usual habit' },
];

async function begin({ app, start, tauri }: Omit<Scene, 'talk'>) {
  tauri.session.withOpenSession({
    ...initialSession,
    turn_count: initialSession.target_turns,
    spoken_turn_count: initialSession.target_turns,
  });
  tauri.rescue.available();
  tauri.streaming.withWarmMicrophone();
  tauri.spokenRecall.withDuePhrases(DUE, 'It saves me time.');
  await app.open();
  await start.continueSession();
}

test('a due phrase is recalled aloud, saved as transcript evidence and followed by the next', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await begin({ app, start, tauri });
  const { spokenRecall } = talk;
  await expect(spokenRecall.panel).toContainText('0 spoken recall attempts saved this session.');

  await spokenRecall.startButton.click();
  await expect(spokenRecall.recorder).toContainText('A practical benefit');
  await spokenRecall.recordAnswer();
  await spokenRecall.saveButton.click();

  await expect(spokenRecall.panel).toContainText('Saved phrase: It saves me time.');
  await expect(spokenRecall.panel).toContainText(`You said: ${finalHeardAnswer}`);
  await expect(spokenRecall.panel).toContainText('The full saved wording was not found');
  await expect(spokenRecall.panel.getByRole('button', { name: 'Next phrase' })).toBeVisible();
  expect(await tauri.calls('submit_daily_recall')).toEqual([
    expect.objectContaining({
      args: { sessionId: 41, phraseId: 7, transcript: finalHeardAnswer },
    }),
  ]);
});

test('leaving the recall returns to the conversation without saving anything', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await begin({ app, start, tauri });
  const { spokenRecall } = talk;
  await spokenRecall.startButton.click();
  await expect(spokenRecall.recorder).toBeVisible();

  await spokenRecall.leaveButton.click();
  await expect(spokenRecall.recorder).toHaveCount(0);
  await expect(spokenRecall.startButton).toBeVisible();
  expect(await tauri.calls('submit_daily_recall')).toHaveLength(0);
});
