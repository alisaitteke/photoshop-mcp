/**
 * Render images/readme-hero-jev.png from images/readme-hero-jev.svg — the
 * "New: Jev" hero in the README. Edit the SVG, then re-run this script.
 *
 * Same approach as generate-hero-image.ts: headless Chrome screenshot, no new
 * deps. The SVG is designed for Inter + JetBrains Mono (install them for an
 * exact match); otherwise it falls back to system fonts.
 * Override the Chrome binary with CHROME_PATH when needed.
 *
 * Run: npx tsx scripts/generate-jev-hero-image.ts
 * Output: images/readme-hero-jev.png (1600x800)
 */
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';

const WIDTH = 1600;
const HEIGHT = 800;
const IMAGES_DIR = join(process.cwd(), 'images');

function chromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (platform() === 'darwin')
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (platform() === 'win32') return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  return 'google-chrome';
}

const svgPath = join(IMAGES_DIR, 'readme-hero-jev.svg');
const pngPath = join(IMAGES_DIR, 'readme-hero-jev.png');

execFileSync(chromePath(), [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  `--window-size=${WIDTH},${HEIGHT}`,
  `--screenshot=${pngPath}`,
  `file://${svgPath}`,
]);

console.log(`✓ ${pngPath} (${WIDTH}x${HEIGHT})`);
