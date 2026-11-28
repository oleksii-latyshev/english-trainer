import { debriefConversation } from '../data/debrief';
import { wrapupSummary } from '../data/wrapup';
import { expect, test } from '../fixtures';

test('the summary offers the rule broken most and Practise this rule starts its run', async ({
  app,
  start,
  talk,
  wrapup,
  mistakeRun,
  tauri,
}) => {
  const { session, dialogue } = debriefConversation(undefined, [], [], {
    rule_key: 'question_word_order',
    title: 'Word order in questions',
    summary: 'Questions put the auxiliary verb before the subject.',
    in_session: 3,
    open: 5,
    came_back: true,
  });
  tauri.coaching.available();
  tauri.mistakeRun.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();
  await start.continueSession();
  await talk.finish();

  await expect(wrapup.review(1)).toBeVisible();
  await expect(wrapup.debrief).not.toContainText('Rule to practise');
  await wrapup.next();
  await wrapup.next();
  await wrapup.next();
  await expect(wrapup.summary).toContainText('Rule to practise');
  await expect(wrapup.summary).toContainText('Word order in questions');
  await expect(wrapup.summary).toContainText(
    'Questions put the auxiliary verb before the subject.',
  );
  await expect(wrapup.summary).toContainText('3 times in this conversation · 5 open');
  await expect(wrapup.summary).toContainText('Came back');

  await wrapup.practiseRule.click();

  await expect(mistakeRun.exercise('Fill the gaps')).toBeVisible();
  expect(await tauri.calls('start_mistake_run')).toEqual([
    expect.objectContaining({ args: { kind: 'rule', ruleKey: 'question_word_order' } }),
  ]);
});

test('the summary has no rule block when no mistake with a lesson was recorded', async ({
  app,
  start,
  talk,
  wrapup,
  tauri,
}) => {
  const { session, dialogue } = debriefConversation();
  tauri.coaching.available();
  tauri.session.withOpenSession(session, dialogue);
  tauri.wrapup.finishingWith(wrapupSummary());
  await app.open();
  await start.continueSession();
  await talk.finish();

  await wrapup.next();
  await wrapup.next();
  await wrapup.next();
  await expect(wrapup.summary).toBeVisible();
  await expect(wrapup.summary).not.toContainText('Rule to practise');
});
