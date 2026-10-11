import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dir, '..');
const SOURCES = join(ROOT, 'assets', 'icons');
const ICONS = join(ROOT, 'src-tauri', 'icons');
const SOURCE_SIZE = 1024;
const DOCK_SIZE = 512;

const DOCK_VARIANTS = [
  { source: 'eva-icon-dark.svg', target: 'dock-dark.png' },
  { source: 'eva-icon-tinted.svg', target: 'dock-light.png' },
] as const;

async function render(svgPath: string, pngPath: string, size: number): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: SOURCE_SIZE, height: SOURCE_SIZE },
      deviceScaleFactor: size / SOURCE_SIZE,
    });
    await page.goto(`file://${svgPath}`);
    await page.screenshot({ path: pngPath, omitBackground: true });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), 'eva-icons-'));
  try {
    const bundleSource = join(work, 'icon.png');
    await render(join(SOURCES, 'eva-icon.svg'), bundleSource, SOURCE_SIZE);
    const tauri = Bun.spawnSync(['bunx', 'tauri', 'icon', bundleSource, '-o', ICONS], {
      cwd: ROOT,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (tauri.exitCode !== 0) throw new Error('tauri icon failed');
    for (const unused of ['android', 'ios', '64x64.png']) {
      rmSync(join(ICONS, unused), { recursive: true, force: true });
    }
    for (const { source, target } of DOCK_VARIANTS) {
      await render(join(SOURCES, source), join(ICONS, target), DOCK_SIZE);
    }
    copyFileSync(join(SOURCES, 'eva-icon.svg'), join(ROOT, 'public', 'app-icon.svg'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
