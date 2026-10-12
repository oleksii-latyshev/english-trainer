import { expect, test } from '../fixtures';
import type { FakeBackend } from '../fixtures/tauri';

async function lastArgs(tauri: FakeBackend, command: string) {
  const calls = await tauri.calls(command);
  return calls[calls.length - 1]?.args;
}

test('choosing a provider is saved and shows its own controls', async ({
  app,
  settings,
  tauri,
}) => {
  await app.open();
  await app.sidebar.openSettings();
  await expect(settings.provider('Gemini')).toBeChecked();
  await expect(app.text('Gemini API key')).toBeVisible();

  await settings.chooseProvider('Antigravity');

  await expect(settings.provider('Antigravity')).toBeChecked();
  await expect(app.text('Antigravity model')).toBeVisible();
  expect((await lastArgs(tauri, 'save_ai_settings'))?.settings).toMatchObject({
    provider: 'agy',
  });

  await settings.chooseFromSelect('Antigravity model', 'Gemini 3.8 Flash Low');
  await expect
    .poll(async () => (await lastArgs(tauri, 'save_ai_settings'))?.settings)
    .toMatchObject({ provider: 'agy', agy_model: 'gemini-3.8-flash-low' });
});

test('a failed save keeps the saved choice and says why', async ({ app, settings, tauri }) => {
  tauri.aiSettingsSeed = { failNextSave: true };
  await app.open();
  await app.sidebar.openSettings();

  await settings.chooseProvider('Apple on-device');

  await expect(app.alert).toContainText('Could not read or save conversation settings locally');
  await expect(settings.provider('Gemini')).toBeChecked();
});

test('the response test streams the reply and shows timings', async ({ app, settings, tauri }) => {
  await app.open();
  await app.sidebar.openSettings();
  await settings.runTest();

  await expect(app.text('Nice to meet you.')).toBeVisible();
  await expect(app.text('First words')).toBeVisible();
  await expect(app.text('0.62 s')).toBeVisible();
  await expect(app.text('Answered by: Gemini 3.5 Flash-Lite')).toBeVisible();
  expect((await lastArgs(tauri, 'generate_follow_up'))?.transcript).toBe(
    'I am testing my English practice setup.',
  );
});

test('the response test explains a provider failure', async ({ app, settings, tauri }) => {
  tauri.aiSettingsSeed = { failTest: true };
  await app.open();
  await app.sidebar.openSettings();
  await settings.runTest();

  await expect(app.alert).toContainText('No Gemini API key is set');
});

test('usage lists requests per model', async ({ app, settings, tauri }) => {
  tauri.aiSettingsSeed = { usage: true };
  await app.open();
  await app.sidebar.openSettings();

  await expect(settings.usageHeading).toBeVisible();
  await expect(app.text('gemini-3.5-flash-lite')).toBeVisible();
  await expect(app.text('142')).toBeVisible();
  await expect(app.text('No rate-limit errors from Gemini today.')).toBeVisible();
});
