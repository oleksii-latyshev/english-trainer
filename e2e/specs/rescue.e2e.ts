import {
  finalHeardAnswer,
  nextStepSuggestion,
  noSpeechMessage,
  rescueFailureMessage,
  simplerSuggestion,
} from '../data/rescue';
import { initialSession } from '../data/sessions';
import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';
import type { App } from '../pages/app';
import type { StartPage } from '../pages/start-page';
import type { TalkPage } from '../pages/talk-page';

type Scene = { app: App; start: StartPage; talk: TalkPage; tauri: FakeBackend };

async function begin({ app, start, tauri }: Omit<Scene, 'talk'>) {
  tauri.session.withOpenSession(initialSession);
  tauri.streaming.withWarmMicrophone();
  tauri.rescue.available();
  await app.open();
  await start.continueSession();
}

test('S opens next-step help and simpler help without ending the live answer', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await recorder.startAndWaitForSignal();
  await talk.focusConversation();
  await talk.pressShortcut('s');
  await expect(rescue.prompt).toBeVisible();
  await expect.poll(async () => (await tauri.rescue.state()).completed).toBe(1);
  await expect(rescue.message(nextStepSuggestion)).toBeVisible();
  await rescue.saySimplerButton.click();
  await expect(rescue.message(simplerSuggestion)).toBeVisible();
  const state = await tauri.rescue.state();
  expect(state.requests.map((request) => request.kind)).toEqual(['next_step', 'simpler']);
  expect(state.snapshots).toBe(2);
  expect(state.finalTranscriptions).toBe(0);
  expect(await tauri.calls('send_practice_turn')).toHaveLength(0);
  await expect(recorder.stopAndReviewButton).toBeEnabled();
});

test('Missing word suggestions can be selected without rewriting or sending the answer', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.rescue.hearingNoSpeech();
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await recorder.startAndWaitForSignal();
  await rescue.stuckButton.click();
  await expect(rescue.message(noSpeechMessage)).toBeVisible();
  await rescue.missingWordButton.click();
  await rescue.description.focus();
  await talk.pressShortcut('s');
  await expect(rescue.description).toHaveValue('s');
  expect((await tauri.rescue.state()).requests).toHaveLength(0);
  await rescue.description.fill('A place where I keep notes and ideas');
  await rescue.findWordButton.click();
  await expect(rescue.candidate('cache')).toBeVisible();
  await expect(rescue.candidate('buffer')).toBeVisible();
  await rescue.candidate('cache').click();
  await expect(rescue.selectedCandidate('cache')).toBeVisible();
  await expect(rescue.candidate('buffer')).toHaveCount(0);
  const { requests } = await tauri.rescue.state();
  expect(requests[requests.length - 1]).toMatchObject({
    kind: 'missing_word',
    description: 'A place where I keep notes and ideas',
    partial_transcript: '',
  });
  expect(await tauri.calls('send_practice_turn')).toHaveLength(0);
  const state = await tauri.rescue.state();
  expect(state.finalTranscriptions).toBe(0);
  expect(state.snapshots).toBe(1);
});

test('a typed provider error is shown and Retry preserves missing-word mode and description', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.rescue.failingOnce('missing_word');
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await recorder.startAndWaitForSignal();
  await rescue.stuckButton.click();
  await expect.poll(async () => (await tauri.rescue.state()).completed).toBe(1);
  await rescue.missingWordButton.click();
  const description = 'A short message that reminds me what to do';
  await rescue.description.fill(description);
  await rescue.findWordButton.click();
  await expect(rescue.message(rescueFailureMessage)).toBeVisible();
  await rescue.retryButton.click();
  await expect(rescue.candidate('cache')).toBeVisible();
  const missingWordRequests = (await tauri.rescue.state()).requests.filter(
    (request) => request.kind === 'missing_word',
  );
  expect(missingWordRequests).toHaveLength(2);
  expect(missingWordRequests.map((request) => request.description)).toEqual([
    description,
    description,
  ]);
});

test('a failed next step keeps the chat and the recording, and Retry brings the suggestion', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.rescue.failingFirstRequest();
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await recorder.startAndWaitForSignal();
  await talk.focusConversation();
  await talk.pressShortcut('s');
  await expect(rescue.message(rescueFailureMessage)).toBeVisible();
  await expect(talk.openingQuestion).toBeVisible();
  await expect(recorder.stopAndReviewButton).toBeEnabled();
  await rescue.retryButton.click();
  await expect(rescue.message(nextStepSuggestion)).toBeVisible();
  await expect(talk.openingQuestion).toBeVisible();
  expect((await tauri.rescue.state()).requests.map((request) => request.kind)).toEqual([
    'next_step',
    'next_step',
  ]);
  expect(await tauri.calls('send_practice_turn')).toHaveLength(0);
});

test('a late response after cancel cannot appear in a new recording', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.rescue.delayingFirstRequestBy(800);
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await recorder.startAndWaitForSignal();
  await talk.focusConversation();
  await talk.pressShortcut('s');
  await expect.poll(async () => (await tauri.rescue.state()).requests).toHaveLength(1);
  await app.pressEscape();
  await expect(recorder.startButton).toBeEnabled();
  await recorder.startAndWaitForSignal();
  await expect(rescue.stuckButton).toBeVisible();
  await expect.poll(async () => (await tauri.rescue.state()).completed).toBe(1);
  await expect(rescue.stuckButton).toBeVisible();
  await expect(rescue.message(nextStepSuggestion)).toHaveCount(0);
  await rescue.stuckButton.click();
  await expect(rescue.message(nextStepSuggestion)).toBeVisible();
  expect((await tauri.rescue.state()).requests).toHaveLength(2);
});

test('Stop remains usable during rescue loading and keeps the full final transcript', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.rescue.delayingBy(700);
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await recorder.startAndWaitForSignal();
  await rescue.stuckButton.click();
  await expect.poll(async () => (await tauri.rescue.state()).requests).toHaveLength(1);
  await recorder.stopAndReview();
  await expect(recorder.heardField).toHaveValue(finalHeardAnswer);
  const state = await tauri.rescue.state();
  expect(state.snapshots).toBe(1);
  expect(state.finalTranscriptions).toBe(1);
  expect(await tauri.calls('send_practice_turn')).toHaveLength(0);
});

test('Continue speaking releases only the rescue hold and preserves the learner hold', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.rescue.withHandsFree();
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await recorder.startAndWaitForSignal();
  await rescue.keepListeningButton.click();
  await expect(rescue.doneThinkingButton).toBeVisible();
  await talk.focusConversation();
  await talk.pressShortcut('s');
  await expect.poll(async () => (await tauri.rescue.state()).completed).toBe(1);
  await rescue.continueSpeakingButton.click();
  await expect(rescue.doneThinkingButton).toBeVisible();
  await expect(rescue.heldOpenStatus).toBeVisible();
  expect((await tauri.rescue.state()).finalTranscriptions).toBe(0);
});

test('rescue pauses silent auto-listen idle expiry and Continue speaking restarts the 20 second wait', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.rescue.withSilentMicrophone();
  await begin({ app, start, tauri });
  const { rescue, recorder } = talk;
  await talk.turnOnAutoListen();
  await expect(talk.autoListenSwitch).toBeChecked();
  await talk.composer.typeInsteadAndSend('I use a notebook to plan.');
  await expect(talk.listening).toBeVisible();
  await rescue.stuckButton.click();
  await expect(rescue.message(nextStepSuggestion)).toBeVisible();
  await app.useFakeClock();
  await app.advanceClock(21_000);
  await expect(recorder.stopAndReviewButton).toBeEnabled();
  await expect(rescue.prompt).toBeVisible();
  await rescue.continueSpeakingButton.click();
  await app.advanceClock(20_500);
  await expect(recorder.startButton).toBeEnabled();
  expect((await tauri.rescue.state()).snapshots).toBe(1);
  expect(await tauri.calls('send_practice_turn')).toHaveLength(1);
});
