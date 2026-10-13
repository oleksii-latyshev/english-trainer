import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';

async function lastArgs(tauri: FakeBackend, command: string) {
  const calls = await tauri.calls(command);
  return calls[calls.length - 1]?.args;
}

test('the microphone is requested only when Allow Microphone is pressed', async ({
  app,
  firstRun,
  tauri,
}) => {
  await app.open();
  await app.sidebar.openSettings();
  await firstRun.openFromSettings();

  await expect(app.heading('First, let’s hear you')).toBeVisible();
  await expect(firstRun.continueButton).toHaveCount(0);
  expect((await tauri.speech.counts()).mediaRequests).toBe(0);

  await firstRun.allowMicrophone.click();

  await expect(app.alert.first()).toBeVisible();
  expect((await tauri.speech.counts()).mediaRequests).toBe(1);
  await expect(firstRun.continueButton).toHaveCount(0);
});

test('setup saves the provider and voice choices and ends on Talk start', async ({
  app,
  firstRun,
  start,
  tauri,
}) => {
  tauri.speech.grantMicrophone();
  tauri.naturalVoice.available();
  await app.open();
  await app.sidebar.openSettings();
  await firstRun.openFromSettings();

  await firstRun.allowMicrophone.click();
  await expect(app.text('We can hear you')).toBeVisible();
  await firstRun.continueButton.click();

  await expect(app.heading('Who will Eva be?')).toBeVisible();
  await expect(firstRun.provider('Gemini')).toBeChecked();
  await expect(firstRun.keyField).toBeVisible();
  await firstRun.provider('Apple on-device').click();
  await expect(firstRun.provider('Apple on-device')).toBeChecked();
  expect((await lastArgs(tauri, 'save_ai_settings'))?.settings).toMatchObject({
    provider: 'apple',
  });
  await expect(firstRun.keyField).toHaveCount(0);
  await firstRun.continueButton.click();

  await expect(app.heading('Pick Eva’s voice')).toBeVisible();
  await firstRun.voice('Female 2').click();
  await firstRun.speed('1.1×').click();
  await expect(firstRun.voice('Female 2')).toBeChecked();
  await firstRun.startTalking.click();

  await expect(start.heading).toBeVisible();
});

test('Back returns to the earlier step without asking for the microphone again', async ({
  app,
  firstRun,
  tauri,
}) => {
  tauri.speech.grantMicrophone();
  await app.open();
  await app.sidebar.openSettings();
  await firstRun.openFromSettings();
  await firstRun.allowMicrophone.click();
  await firstRun.continueButton.click();

  await firstRun.backButton.click();

  await expect(firstRun.allowMicrophone).toHaveCount(0);
  await expect(firstRun.continueButton).toBeVisible();
});

test('Skip setup leaves for Talk start', async ({ app, firstRun, start }) => {
  await app.open();
  await app.sidebar.openSettings();
  await firstRun.openFromSettings();

  await firstRun.skip.click();

  await expect(start.heading).toBeVisible();
});
