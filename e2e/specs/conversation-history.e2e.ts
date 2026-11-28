import { debriefConversation, forTwoYears, getPaid } from '../data/debrief';
import {
  olderConversations,
  takenBefore,
  travelConversation,
  workConversation,
} from '../data/history';
import { wrapupSummary } from '../data/wrapup';

import { expect, test } from '../fixtures';

const reopened = { ...wrapupSummary(), turn_count: 3 };

test('an earlier conversation reopens from the start screen with its Debrief and takes a word', async ({
  app,
  start,
  wrapup,
  tauri,
}) => {
  const { dialogue } = debriefConversation();
  tauri.coaching.available();
  tauri.history.with([workConversation, travelConversation], reopened, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();

  await expect(start.recentConversations).toContainText('Word order in questions');
  await expect(start.recentConversations).toContainText('3 answers');
  await expect(start.recentConversations).toContainText('1 answer');
  await start.openRecent(workConversation.title);

  await expect(wrapup.reopenedHeading).toBeVisible();
  await expect(wrapup.progress).toHaveText('1 / 3');
  await expect(wrapup.review(1)).toContainText('I have worked there for two years.');

  await wrapup.take(forTwoYears.phrase).click();
  await expect(wrapup.taken(forTwoYears.phrase)).toBeDisabled();
  expect(await tauri.calls('save_phrase_card')).toEqual([
    expect.objectContaining({
      args: expect.objectContaining({ phrase: 'for two years', session_id: 41, sequence: 1 }),
    }),
  ]);

  await wrapup.leaveButton.click();
  await expect(start.recentConversations).toBeVisible();
});

test('a word already saved from that conversation shows as taken and is not saved twice', async ({
  app,
  start,
  wrapup,
  tauri,
}) => {
  const { dialogue } = debriefConversation();
  tauri.coaching.available();
  tauri.memory.withLibrary({ mistakes: [], phrase_cards: [takenBefore], due_count: 0 });
  tauri.history.with([workConversation], reopened, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();
  await start.openRecent(workConversation.title);

  await expect(wrapup.taken(forTwoYears.phrase)).toBeDisabled();
  await expect(wrapup.take(getPaid.phrase)).toBeEnabled();
  await expect(wrapup.debrief).toContainText('1 of 5 taken');
  expect(await tauri.calls('save_phrase_card')).toEqual([]);
});

test('See all lists every finished conversation, newest first, and Back returns to the list', async ({
  app,
  conversations,
  start,
  wrapup,
  tauri,
}) => {
  const { dialogue } = debriefConversation();
  tauri.coaching.available();
  tauri.history.with(
    [workConversation, travelConversation, ...olderConversations(22)],
    reopened,
    dialogue,
  );
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();

  await expect(start.recentConversations.getByRole('listitem')).toHaveCount(5);
  await start.seeAllConversations();

  await expect(conversations.heading).toBeVisible();
  await expect(conversations.rows.first()).toContainText('Work & technology');
  await expect(conversations.rows).toHaveCount(21);
  await conversations.showMore.click();
  await expect(conversations.rows).toHaveCount(24);
  await expect(conversations.showMore).toHaveCount(0);

  await conversations.open(workConversation.title);
  await expect(wrapup.reopenedHeading).toBeVisible();
  await wrapup.leaveButton.click();
  await expect(conversations.heading).toBeVisible();
});
