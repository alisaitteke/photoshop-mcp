/**
 * Render images/og-social.png (1200x630) from the site's own tokens.
 *
 * Needs a headless Chromium, so this is run by hand when the branding or the
 * tool counts change, and the PNG is committed:
 *
 *   npx playwright install chromium   # once
 *   npx tsx scripts/generate-og-image.ts
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'images', 'og-social.png');

const meta = JSON.parse(readFileSync(join(ROOT, 'site', 'data', 'meta.json'), 'utf8')) as {
  toolsTotal: number;
  toolsRecipes: number;
};

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Plex';
    src: local('IBM Plex Sans'), local('IBM Plex Sans Text');
    font-weight: 100 700;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px;
    background: #0a1020;
    color: #e6ebf4;
    font-family: 'IBM Plex Sans', 'Plex', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    position: relative;
    overflow: hidden;
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(45deg, rgba(148,163,184,.07) 25%, transparent 25%, transparent 75%, rgba(148,163,184,.07) 75%),
      linear-gradient(45deg, rgba(148,163,184,.07) 25%, transparent 25%, transparent 75%, rgba(148,163,184,.07) 75%);
    background-size: 40px 40px;
    background-position: 0 0, 20px 20px;
    -webkit-mask-image: linear-gradient(160deg, #000 0%, rgba(0,0,0,.1) 70%, transparent 100%);
  }
  .wrap { position: relative; padding: 76px 80px; height: 100%; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand svg { display: block; }
  .brand span { font-size: 28px; font-weight: 600; letter-spacing: -.01em; }
  h1 {
    margin: 54px 0 0;
    font-size: 82px; font-weight: 600; line-height: .98; letter-spacing: -.035em;
    max-width: 14ch;
  }
  p { margin: 26px 0 0; font-size: 27px; line-height: 1.42; color: #a4afc3; max-width: 30ch; }
  .foot { margin-top: auto; display: flex; align-items: baseline; gap: 28px; font-size: 21px; color: #7d8ba4; }
  .foot b { color: #22d3ee; font-weight: 500; }
  .chip {
    position: absolute; right: 80px; top: 150px;
    width: 336px; height: 336px; border-radius: 18px;
    border: 1px solid #263352; background: #0b1220;
    box-shadow: 0 30px 60px -30px rgba(0,0,0,.8);
    display: grid; place-items: center;
  }
  .chip svg { width: 244px; height: 244px; }
  .ants { stroke: #22d3ee; stroke-width: 2; stroke-dasharray: 6 4; fill: none; }
</style>
<body>
  <div class="grid"></div>
  <div class="chip">
    <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="c" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#e8edf5"/>
          <rect width="10" height="10" fill="#c9d3e1"/>
          <rect x="10" y="10" width="10" height="10" fill="#c9d3e1"/>
        </pattern>
      </defs>
      <rect width="160" height="160" rx="6" fill="url(#c)"/>
      <g fill="#2b1d18">
        <circle cx="80" cy="62" r="26"/>
        <path d="M34 160 C34 106 126 106 126 160 Z"/>
      </g>
      <rect class="ants" x="1" y="1" width="158" height="158" rx="6"/>
    </svg>
  </div>
  <div class="wrap">
    <div class="brand">
      <svg width="40" height="40" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="#0b1220"/>
        <rect x="5" y="5" width="10.5" height="10.5" rx="2.5" fill="#22d3ee"/>
        <rect x="16.5" y="16.5" width="10.5" height="10.5" rx="2.5" fill="#22d3ee"/>
        <rect x="16.5" y="5" width="10.5" height="10.5" rx="2.5" fill="#22d3ee" opacity=".22"/>
        <rect x="5" y="16.5" width="10.5" height="10.5" rx="2.5" fill="#22d3ee" opacity=".22"/>
      </svg>
      <span>Photoshop MCP</span>
    </div>
    <h1>Tell Photoshop what you want.</h1>
    <p>Claude, Cursor and any MCP client, connected to Adobe Photoshop.</p>
    <div class="foot">
      <span><b>${meta.toolsTotal}</b> tools · <b>${meta.toolsRecipes}</b> one-step recipes</span>
      <span>photoshop-mcp.com</span>
    </div>
  </div>
</body>`;

const dir = mkdtempSync(join(tmpdir(), 'og-'));
const page = join(dir, 'og.html');
const script = join(dir, 'shot.mjs');
writeFileSync(page, html, 'utf8');
writeFileSync(
  script,
  `import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto('file://${page}');
await p.waitForTimeout(400);
await p.screenshot({ path: '${OUT}' });
await b.close();
`,
  'utf8',
);

try {
  execSync(`node ${script}`, { cwd: ROOT, stdio: 'inherit' });
  console.log(`og image written: ${OUT}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
