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
