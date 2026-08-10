/**
 * Post-build sitemap for GitHub Pages + copy public assets into dist.
 */
import { cpSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const DIST = join(SITE_ROOT, '.vitepress', 'dist');
const PUBLIC = join(SITE_ROOT, 'public');
const BASE_URL = 'https://alisaitteke.github.io/photoshop-mcp';

function copyPublicAssets() {
  for (const name of readdirSync(PUBLIC)) {
    const src = join(PUBLIC, name);
    const dest = join(DIST, name);
    cpSync(src, dest, { recursive: true });
  }
  console.log('public assets copied to dist');
}

function collectHtmlFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      collectHtmlFiles(path, acc);
    } else if (name.endsWith('.html')) {
      acc.push(path);
    }
  }
  return acc;
}

function toUrl(htmlPath) {
  const rel = relative(DIST, htmlPath).replace(/\\/g, '/');
  if (rel === '404.html') return null;
  if (rel === 'index.html') return `${BASE_URL}/`;
  if (rel.endsWith('/index.html')) {
    return `${BASE_URL}/${rel.slice(0, -'/index.html'.length)}/`;
  }
  return `${BASE_URL}/${rel.replace(/\.html$/, '')}`;
}

copyPublicAssets();

const staticUrls = [`${BASE_URL}/llms.txt`, `${BASE_URL}/llms-full.txt`, `${BASE_URL}/ai.txt`];

const files = collectHtmlFiles(DIST);
const urls = [...files.map((f) => toUrl(f)).filter(Boolean), ...staticUrls].sort();

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((loc) => `  <url><loc>${loc}</loc></url>`),
  '</urlset>',
  '',
].join('\n');

writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml written (${urls.length} URLs)`);

