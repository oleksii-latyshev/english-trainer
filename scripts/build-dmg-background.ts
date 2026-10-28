import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dir, '..');
const SOURCE = join(ROOT, 'assets', 'dmg', 'background.html');
const OUTPUT = join(ROOT, 'src-tauri', 'dmg');
const WIDTH = 660;
const HEIGHT = 420;

async function render(scale: 1 | 2, pngPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: scale,
    });
    await page.goto(`file://${SOURCE}`);
    await page.screenshot({ path: pngPath });
  } finally {
    await browser.close();
  }
}

function run(command: string[]): void {
  const result = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) throw new Error(`${command[0]} failed`);
}

async function main(): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), 'dmg-background-'));
  try {
    const x1 = join(OUTPUT, 'background.png');
    const x2 = join(work, 'background@2x.png');
    await render(1, x1);
    await render(2, x2);
    run(['sips', '-s', 'dpiWidth', '72', '-s', 'dpiHeight', '72', x1]);
    run(['sips', '-s', 'dpiWidth', '144', '-s', 'dpiHeight', '144', x2]);
    run(['tiffutil', '-cathidpicheck', x1, x2, '-out', join(OUTPUT, 'background.tiff')]);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
