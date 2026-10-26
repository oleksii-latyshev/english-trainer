import { budSeed } from '../data/growth';
import { expect, test } from '../fixtures';

test('the sidebar card shows the stage and progress and opens the Growth screen with today’s gains', async ({
  app,
  growth,
  tauri,
}) => {
  tauri.growth.with(budSeed);
  await app.open();

  await expect(app.sidebar.growthCard).toContainText('Bud');
  await expect(app.sidebar.growthCard).toContainText('20 / 40 drops');
  await expect(app.sidebar.growthCard).toContainText('20 drops to Bloom');

  await app.sidebar.openGrowth();

  await expect(growth.heading).toBeVisible();
  await expect(growth.youAreHere).toContainText('Bud');
  await expect(growth.today).toContainText('20 / 40 drops to Bloom');
  await expect(growth.today).toContainText('+12');
  await expect(growth.today).toContainText('12 min about Explaining a bug');
  await expect(growth.today).toContainText('+5');
  await expect(growth.today).toContainText('Said “most of” on your own');
  await expect(growth.howItGrows).toContainText('Days off — Eva naps');
});

test('Show growth off hides the card while the progress is kept', async ({
  app,
  settings,
  tauri,
}) => {
  tauri.growth.with(budSeed);
  await app.open();
  await expect(app.sidebar.growthCard).toBeVisible();

  await app.sidebar.openSettings();
  await settings.openEva();
  await settings.showGrowth.click();

  await expect(app.sidebar.growthCard).toHaveCount(0);

  await settings.showGrowth.click();

  await expect(app.sidebar.growthCard).toContainText('20 / 40 drops');
});
