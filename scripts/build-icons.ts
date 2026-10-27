import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const STAGES = [0, 1, 2, 3, 4, 5] as const;
type Stage = (typeof STAGES)[number];

const STEM_HEIGHT: Record<Stage, number> = { 0: 0, 1: 12, 2: 15, 3: 20, 4: 22, 5: 25 };
const SPARKLES = [
  { x: -26, y: -2, fill: '#FFF4C2' },
  { x: 25, y: -10, fill: '#FFFFFF' },
  { x: 30, y: 8, fill: '#FFE08A' },
  { x: -20, y: -20, fill: '#FFFFFF' },
  { x: 6, y: -22, fill: '#FFF4C2' },
] as const;
const PLANT_GROUP = /<g transform="translate\(57 3\)">[\s\S]*?<\/g>/;
const EXTRA_DEFS = `<linearGradient id="leafLeft" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B5F0C8"/><stop offset="1" stop-color="#5DB97E"/></linearGradient>
    <linearGradient id="bud" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#5DB97E"/><stop offset="0.35" stop-color="#5DB97E"/><stop offset="0.8" stop-color="#FF9EC0"/></linearGradient>
  </defs>`;

function leafPath(width: number, height: number, side: 'left' | 'right'): string {
  if (side === 'right') {
    return `M0.4 0A${width} ${height} 0 0 1 ${width + 0.4} ${height}A${width} ${height} 0 0 1 0.4 0Z`;
  }
  return `M-0.4 0A${width} ${height} 0 0 0 ${-width - 0.4} ${height}A${width} ${height} 0 0 0 -0.4 0Z`;
}

function flower(stage: Stage, stemTop: number): string {
  const isFull = stage >= 5;
  const distance = isFull ? 7.5 : 6.2;
  const petalRadius = isFull ? 5.5 : 4.7;
  const petalCount = isFull ? 6 : 5;
  const centreY = stemTop - 5;
  const petals = Array.from({ length: petalCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / petalCount;
    const cx = (Math.cos(angle) * distance).toFixed(2);
    const cy = (centreY + Math.sin(angle) * distance).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${petalRadius}" fill="#FF9EC0"/>`;
  });
  const centre = `<circle cx="0" cy="${centreY}" r="${isFull ? 4.5 : 3.6}" fill="#FFD66B"/>`;
  const sparkles = isFull
    ? SPARKLES.map(
        (sparkle) =>
          `<circle cx="${sparkle.x}" cy="${centreY + sparkle.y}" r="1.1" fill="${sparkle.fill}"/>`,
      )
    : [];
  return [...petals, centre, ...sparkles].join('');
}

function bud(stemTop: number): string {
  const top = stemTop - 12;
  const d = `M-5.5 ${top + 8.4}A5.5 8.4 0 0 1 0 ${top}A5.5 8.4 0 0 1 5.5 ${top + 8.4}A5.5 5.6 0 0 1 0 ${top + 14}A5.5 5.6 0 0 1 -5.5 ${top + 8.4}Z`;
  return `<path d="${d}" fill="url(#bud)"/>`;
}

function plant(stage: Stage): string {
  const stemHeight = STEM_HEIGHT[stage];
  const stemTop = -stemHeight;
  const isFull = stage >= 5;
  const leafWidth = isFull ? 22 : 20;
  const leafHeight = isFull ? 13 : 12;
  const leafTop = stage === 1 ? stemTop - 6 : stemTop * 0.55 - 6;
  const parts: string[] = [];
  if (stage === 0) parts.push('<ellipse cx="0" cy="-2.5" rx="5" ry="4" fill="url(#leaf)"/>');
  if (stage >= 1) {
    parts.push(
      `<rect x="-1.4" y="${stemTop}" width="2.8" height="${stemHeight + 3}" rx="1.4" fill="#5DB97E"/>`,
      `<path d="${leafPath(leafWidth, leafHeight, 'right')}" transform="translate(0 ${leafTop})" fill="url(#leaf)"/>`,
    );
  }
  if (stage >= 2) {
    parts.push(
      `<path d="${leafPath(leafWidth, leafHeight, 'left')}" transform="translate(0 ${leafTop})" fill="url(#leafLeft)"/>`,
    );
  }
  if (stage === 3) parts.push(bud(stemTop));
  if (stage >= 4) parts.push(flower(stage, stemTop));
  return `<g transform="translate(57 3)">${parts.join('')}</g>`;
}

function stageSvg(source: string, stage: Stage): string {
  return source.replace('</defs>', EXTRA_DEFS).replace(PLANT_GROUP, plant(stage));
}

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
    const evaSource = readFileSync(join(SOURCES, 'eva-icon.svg'), 'utf8');
    for (const stage of STAGES) {
      const svgPath = join(work, `dock-eva-${stage}.svg`);
      writeFileSync(svgPath, stageSvg(evaSource, stage));
      await render(svgPath, join(ICONS, `dock-eva-${stage}.png`), DOCK_SIZE);
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
