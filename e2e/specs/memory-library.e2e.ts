import { figureOutEvidence, libraryMemory } from '../data/library';
import { expect, test } from '../fixtures';

test('Memory lists phrases and mistakes with their status, next review and own use', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withLibrary(libraryMemory);
  await app.open();
  await app.sidebar.openMemory();

  await expect(memory.phrasesTab).toContainText('2');
  await expect(memory.mistakesTab).toContainText('1');
  await expect(memory.row('figure out')).toContainText('Daily stand-up');
  await expect(memory.row('figure out')).toContainText('Improving');
  await expect(memory.row('figure out')).toContainText('Today');
  await expect(memory.row('stale data')).toContainText('In 12 days');

  await memory.openMistakes();
  await expect(memory.row('the most part of')).toContainText('Grammar · seen 4×');
  await expect(memory.row('the most part of')).toContainText('Tomorrow');
});

test('the status summary counts everything that is not archived', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withLibrary(libraryMemory);
  await app.open();
  await app.sidebar.openMemory();

  await expect(memory.statusSummary).toContainText('3 items');
  await expect(memory.statusSummary).toContainText('Improving 1');
  await expect(memory.statusSummary).toContainText('Stable 1');
  await expect(memory.statusSummary).toContainText('Learning 1');
});

test('an opened phrase shows what the learner said on their own', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withLibrary(libraryMemory, [figureOutEvidence]);
  await app.open();
  await app.sidebar.openMemory();
  await memory.open('figure out');

  await expect(memory.evidenceFor('On your own')).toBeVisible();
  await expect(memory.evidenceFor('we still need to figure out why the keys expire')).toBeVisible();
  expect(await tauri.calls('get_memory_usage_evidence')).toHaveLength(1);
});

test('an opened mistake explains the correction and says when nothing was seen yet', async ({
  app,
  memory,
  tauri,
}) => {
  tauri.memory.withLibrary(libraryMemory);
  await app.open();
  await app.sidebar.openMemory();
  await memory.openMistakes();
  await memory.open('the most part of');

  await expect(app.text('English says “most of the users”')).toBeVisible();
  await expect(app.text('Nothing yet. Use this wording in a conversation')).toBeVisible();
});

test('archiving hides an item until archived ones are shown', async ({ app, memory, tauri }) => {
  tauri.memory.withLibrary(libraryMemory);
  await app.open();
  await app.sidebar.openMemory();
  await memory.open('stale data');
  await memory.archiveButton('stale data').click();

  await expect(app.text('Archived. Saving it again brings it back.')).toBeVisible();
  await expect(memory.row('stale data')).toHaveCount(0);
  expect(await tauri.calls('archive_learning_item')).toEqual([
    expect.objectContaining({ args: { item_type: 'phrase', item_id: 12 } }),
  ]);

  await memory.showArchived.click();
  await expect(memory.row('stale data')).toContainText('Archived');
});

test('deleting asks first and removes the item and its history', async ({ app, memory, tauri }) => {
  tauri.memory.withLibrary(libraryMemory);
  await app.open();
  await app.sidebar.openMemory();
  await memory.open('stale data');

  await memory.deleteButton('stale data').click();
  await memory.cancelDeleteButton.click();
  await expect(memory.row('stale data')).toBeVisible();
  expect(await tauri.calls('delete_phrase_card')).toEqual([]);

  await memory.deleteButton('stale data').click();
  await memory.confirmDeleteButton.click();
  await expect(app.text('Removed from Memory')).toBeVisible();
  await expect(memory.row('stale data')).toHaveCount(0);
  expect(await tauri.calls('delete_phrase_card')).toEqual([
    expect.objectContaining({ args: { phrase_id: 12 } }),
  ]);
});

test('search narrows both lists and says when nothing matches', async ({ app, memory, tauri }) => {
  tauri.memory.withLibrary(libraryMemory);
  await app.open();
  await app.sidebar.openMemory();

  await memory.search.fill('stale');
  await expect(memory.row('stale data')).toBeVisible();
  await expect(memory.row('figure out')).toHaveCount(0);
  await expect(memory.mistakesTab).toContainText('0');

  await memory.search.fill('zzz');
  await expect(app.text('Nothing matches “zzz”')).toBeVisible();
});

test('a failed read offers a retry that shows Memory', async ({ app, memory, tauri }) => {
  tauri.memory.withLibrary(libraryMemory).failingFirstRead();
  await app.open();
  await app.sidebar.openMemory();

  await expect(memory.loadFailure).toBeVisible();
  await memory.retryButton.click();
  await expect(memory.row('figure out')).toBeVisible();
});
