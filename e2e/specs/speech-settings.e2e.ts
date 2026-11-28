import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';

async function lastArgs(tauri: FakeBackend, command: string) {
  const calls = await tauri.calls(command);
  return calls[calls.length - 1]?.args;
}

test('the model choice lists what is installed with its measurements and is saved', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.speechSettingsSeed = {};
  await app.open();
  await app.sidebar.openSettings();

  await expect(settings.modelChoice()).toContainText('small.en');
  await settings.chooseFromSelect('Model', 'base.en · 148 MB');

  await expect
    .poll(async () => (await lastArgs(tauri, 'save_speech_model'))?.model_file)
    .toBe('ggml-base.en.bin');
  await expect(settings.modelChoice()).toContainText('base.en');
});

test('a rejected model choice says why and keeps the saved model', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.speechSettingsSeed = { failNextModelSave: true };
  await app.open();
  await app.sidebar.openSettings();

  await settings.chooseFromSelect('Model', 'base.en');

  await expect(app.alert).toContainText('That model is not installed.');
  await expect(settings.modelChoice()).toContainText('small.en');
});

test('the live transcript switch is saved', async ({ app, settings, tauri }) => {
  tauri.speechSettingsSeed = {};
  await app.open();
  await app.sidebar.openSettings();
  await expect(settings.speech.getByRole('switch', { name: 'Live transcript' })).toBeChecked();

  await settings.toggleSwitch('Live transcript');

  await expect
    .poll(async () => (await lastArgs(tauri, 'save_live_transcript'))?.live_transcript)
    .toBe(false);
  await expect(settings.speech.getByRole('switch', { name: 'Live transcript' })).not.toBeChecked();
});

test('the speech check shows the sentence, the model in memory and the measured results', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.speechSettingsSeed = {};
  await app.open();
  await app.sidebar.openSettings();

  await expect(app.text('Model in memory')).toBeVisible();
  await expect(app.text('Kept loaded · ready')).toBeVisible();
  await expect(app.text(/1 of 2 sentences recorded/)).toBeVisible();
  await expect(app.text('The pull request needs one more review.')).toBeVisible();
  await expect(settings.speech.getByRole('table')).toContainText('small.en');
  await expect(settings.speech.getByRole('table')).toContainText('in use');
});

test('the microphone check explains a microphone that cannot be opened', async ({
  app,
  settings,
}) => {
  await app.open();
  await app.sidebar.openSettings();

  await settings.recordMicrophoneCheck();

  await expect(settings.microphone).toContainText('Microphone access was denied');
  await expect(settings.microphone.getByRole('button', { name: 'Record again' })).toBeVisible();
});

test('a missing speech model is downloaded after consent, with progress, and is ready afterwards', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.speechSettingsSeed = { missingModel: true };
  await app.open();
  await app.sidebar.openSettings();

  await expect(settings.speech).toContainText('Speech model');
  await expect(settings.speech).toContainText('465 MB');
  await settings.modelDownloadButton.click();
  await expect(settings.modelDownloadDialog).toContainText('465 MB model from huggingface.co');
  expect(await tauri.calls('download_speech_model')).toHaveLength(0);

  await settings.modelDownloadDialog.getByRole('button', { name: /^Download/ }).click();
  await expect(settings.modelDownloadProgress).toBeVisible();
  await expect(settings.speech).toContainText('233 MB of 465 MB');

  await settings.finishModelDownload();
  await expect(app.text('Speech model ready.')).toBeVisible();
  await expect(settings.modelDownloadButton).toHaveCount(0);
  await expect(settings.modelChoice()).toContainText('small.en');
});

test('cancelling the speech model download goes back to the Download button', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.speechSettingsSeed = { missingModel: true };
  await app.open();
  await app.sidebar.openSettings();

  await settings.modelDownloadButton.click();
  await settings.modelDownloadDialog.getByRole('button', { name: /^Download/ }).click();
  await expect(settings.modelDownloadProgress).toBeVisible();
  await settings.speech.getByRole('button', { name: 'Cancel' }).click();

  await expect(settings.modelDownloadProgress).toHaveCount(0);
  await expect(settings.modelDownloadButton).toBeVisible();
  await expect(app.alert).toHaveCount(0);
  expect(await tauri.calls('cancel_speech_model_download')).toHaveLength(1);
});

test('a failed speech model download says why and offers another try', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.speechSettingsSeed = { missingModel: true, failNextDownload: true };
  await app.open();
  await app.sidebar.openSettings();

  await settings.modelDownloadButton.click();
  await settings.modelDownloadDialog.getByRole('button', { name: /^Download/ }).click();

  await expect(app.alert).toContainText('did not match its checksum');
  await expect(settings.speech.getByRole('button', { name: 'Try again' })).toBeVisible();
});
