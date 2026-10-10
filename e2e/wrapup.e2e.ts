import { expect, test } from '@playwright/test';
import { finishedSession } from './fixtureData';
import { harnessState } from './harnessTypes';
import { installTauriFixture } from './tauriFixture';
import { installWrapupFixture } from './wrapupFixture';

function summary(
  wrapupPreparation: NonNullable<typeof finishedSession.wrapup_preparation>,
  phrases = finishedSession.phrases,
  pendingCoaching = 0,
) {
  return {
    ...finishedSession,
    wrapup_preparation: wrapupPreparation,
    phrases,
    pending_coaching: pendingCoaching,
  };
}

const phraseSet = [
  {
    sequence: 1,
    phrase: 'It saves me time.',
    note: 'Use this to explain a practical benefit.',
    you_said: 'It make my work faster.',
  },
  {
    sequence: 2,
    phrase: 'I tend to plan ahead.',
    note: 'Use tend to for a usual habit.',
    you_said: 'Usually I plan before.',
  },
  {
    sequence: 3,
    phrase: 'That gives me more room to focus.',
    note: 'Use this to describe a helpful result.',
    you_said: 'Then I have time for focus.',
  },
];

async function finishSession(page: Parameters<typeof installTauriFixture>[0]) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Speak/ }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nice session. Here’s what to keep.' }),
  ).toBeVisible();
}

test('finishing stays usable while phrase generation and coaching are pending', async ({
  page,
}) => {
  await installTauriFixture(page);
  await installWrapupFixture(page, { finished: summary({ state: 'pending' }, [], 1) });
  await finishSession(page);

  await expect(page.getByText('Preparing phrases from your answers…')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Phrases worth learning' })
      .getByText('Still checking 1 answer…'),
  ).toBeVisible();
  await expect(page.getByText('Speaking time', { exact: true })).toBeVisible();
  await expect(page.getByText('no spoken answers to time', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'What shall we talk about?' })).toBeVisible();
});

test('ready phrase cards show the usage note and exact learner quote', async ({ page }) => {
  await installTauriFixture(page);
  await installWrapupFixture(page, { finished: summary({ state: 'pending' }, [], 1) });
  await finishSession(page);
  await page.evaluate(
    (phrases) => {
      const current = window.__ET_HARNESS__.finished;
      if (!current) throw new Error('Expected a finished session.');
      window.__ET_WRAPUP__.completePreparation({
        ...current,
        phrases,
        pending_coaching: 1,
        wrapup_preparation: { state: 'ready' },
      });
    },
    phraseSet.slice(0, 1),
  );

  await expect(page.getByText('It saves me time.')).toBeVisible();
  await expect(page.getByText('Use this to explain a practical benefit.')).toBeVisible();
  await expect(page.getByText('You said: “It make my work faster.”')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Phrases worth learning' })
      .getByText('Still checking 1 answer…'),
  ).toBeVisible();
});

test('failed phrase preparation retries and accepts the later ready event', async ({ page }) => {
  const failed = summary(
    {
      state: 'failed',
      error: { code: 'timeout', message: 'Phrase service timed out. Try again.' },
    },
    [],
  );
  const ready = summary({ state: 'ready' }, phraseSet.slice(0, 1));
  await installTauriFixture(page);
  await installWrapupFixture(page, { finished: failed, afterRetry: ready });
  await finishSession(page);

  await expect(page.getByRole('alert')).toContainText('Phrase service timed out. Try again.');
  await page.getByRole('button', { name: 'Retry phrases' }).click();
  await expect(page.getByText('It saves me time.')).toBeVisible();
  expect((await harnessState(page)).calls).toContainEqual(
    expect.objectContaining({ command: 'retry_session_wrapup', args: { sessionId: 41 } }),
  );
});

test('wrap-up events for another session do not replace the visible session', async ({ page }) => {
  await installTauriFixture(page);
  await installWrapupFixture(page, { finished: summary({ state: 'pending' }, [], 1) });
  await finishSession(page);
  await page.evaluate(
    (phrases) => {
      const current = window.__ET_HARNESS__.finished;
      if (!current) throw new Error('Expected a finished session.');
      window.__ET_WRAPUP__.completePreparation({
        ...current,
        session_id: 99,
        phrases,
        wrapup_preparation: { state: 'ready' },
      });
    },
    phraseSet.slice(0, 1),
  );

  await expect(page.getByText('Preparing phrases from your answers…')).toBeVisible();
  await expect(page.getByText('It saves me time.')).toHaveCount(0);
});

test('save all is atomic, removed phrases stay out, duplicates are not undone', async ({
  page,
}) => {
  const existing = {
    id: 321,
    phrase: phraseSet[0].phrase,
    normalized_phrase: phraseSet[0].phrase.toLowerCase(),
    meaning_or_note: 'Already remembered.',
    session_id: null,
    sequence: null,
    created_at: 1,
    last_reviewed_at: null,
    next_review_at: 2,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'new' as const,
    is_due: true,
  };
  await installTauriFixture(page);
  await installWrapupFixture(page, {
    finished: summary({ state: 'ready' }, phraseSet),
    existingCards: [existing],
  });
  await finishSession(page);
  await page.getByRole('button', { name: 'Remove phrase “I tend to plan ahead.”' }).click();
  await page.getByRole('button', { name: 'Save all 2 phrases to Memory' }).click();
  await expect(page.getByRole('button', { name: 'Saved to Memory' })).toBeVisible();
  const savedCall = (await harnessState(page)).calls.find(
    (call) => call.command === 'save_wrapup_phrases',
  );
  expect(savedCall?.args).toEqual({
    sessionId: 41,
    phrases: [phraseSet[0].phrase, phraseSet[2].phrase],
  });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => page.evaluate(() => window.__ET_WRAPUP__.deletedIds)).toEqual([500]);
  await expect(page.getByText('It saves me time.')).toBeVisible();
  expect(await page.evaluate(() => window.__ET_WRAPUP__.deletedIds)).not.toContain(321);
});

test('ready empty wrap-up has its own message while coaching is still pending', async ({
  page,
}) => {
  await installTauriFixture(page);
  await installWrapupFixture(page, { finished: summary({ state: 'ready' }, [], 1) });
  await finishSession(page);

  await expect(page.getByText('No phrases to keep from this session.')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Phrases worth learning' })
      .getByText('Still checking 1 answer…'),
  ).toBeVisible();
});
