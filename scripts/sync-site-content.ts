/**
 * Sync repo docs, README locales, and images into site/ for VitePress build.
 * Run: npx tsx scripts/sync-site-content.ts (wired into site prebuild)
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const CONTENT = join(SITE, 'content');
const PUBLIC_IMAGES = join(SITE, 'public', 'images');

const SITE_URL = 'https://alisaitteke.github.io/photoshop-mcp';
const GITHUB_REPO = 'https://github.com/alisaitteke/photoshop-mcp';

const LOCALES = [
  { key: 'en', readme: 'README.md', contentDir: CONTENT },
  { key: 'tr', readme: 'README.tr.md', contentDir: join(CONTENT, 'tr') },
  { key: 'zh', readme: 'README.zh-CN.md', contentDir: join(CONTENT, 'zh') },
  { key: 'es', readme: 'README.es.md', contentDir: join(CONTENT, 'es') },
  { key: 'de', readme: 'README.de.md', contentDir: join(CONTENT, 'de') },
  { key: 'ja', readme: 'README.ja.md', contentDir: join(CONTENT, 'ja') },
] as const;

const README_LINK_MAP: Record<string, string> = {
  'README.md': '/readme',
  'README.tr.md': '/tr/readme',
  'README.zh-CN.md': '/zh/readme',
  'README.es.md': '/es/readme',
  'README.de.md': '/de/readme',
  'README.ja.md': '/ja/readme',
};

const DOC_FILES = [
  'architecture.md',
  'available-tools.md',
  'prompt-layer.md',
  'development.md',
  'troubleshooting.md',
  'anonymous-usage-analytics.md',
  'social-preview.md',
];

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function copyImages(): void {
  ensureDir(PUBLIC_IMAGES);
  const srcImages = join(ROOT, 'images');
  if (!existsSync(srcImages)) return;
  for (const name of readdirSync(srcImages)) {
    copyFileSync(join(srcImages, name), join(PUBLIC_IMAGES, name));
  }
}

function convertImgToMarkdown(text: string): string {
  return text.replace(
    /<img\s+src="([^"]+)"\s+alt="([^"]*)"\s*(?:width="[^"]*"\s*)?\/?>/gi,
    '![$2]($1)',
  );
}

function stripHtmlBlocks(text: string): string {
  let out = text;
  out = out.replace(/<p align="center">\s*/gi, '');
  out = out.replace(/<\/p>\s*(?=\n|$)/gi, '\n');
  out = out.replace(/<a href="[^"]*">\s*/gi, '');
  out = out.replace(/<\/a>/gi, '');
  out = convertImgToMarkdown(out);
  return out;
}

function rewriteMarkdown(text: string, localeKey: string): string {
  let out = stripHtmlBlocks(text);

  // Relative images → absolute site URLs (avoids Vite bundling absolute /images paths)
  out = out.replace(/\.\/images\//g, `${SITE_URL}/images/`);
  out = out.replace(/\]\(\/images\//g, `](${SITE_URL}/images/`);
  out = out.replace(/\]\(images\//g, `](${SITE_URL}/images/`);

  // docs/*.md links (with optional anchor)
  out = out.replace(
    /\]\(docs\/([a-z0-9-]+)\.md(#[^)]+)?\)/gi,
    (_match, slug: string, anchor?: string) => `](/docs/${slug}${anchor ?? ''})`,
  );
  out = out.replace(
    /\[`docs\/([a-z0-9-]+)\.md`\]/gi,
    (_match, slug: string) => `[\`/docs/${slug}\`]`,
  );

  // README cross-locale links
  for (const [file, path] of Object.entries(README_LINK_MAP)) {
    const escaped = file.replace('.', '\\.');
    out = out.replace(new RegExp(`\\]\\(${escaped}\\)`, 'g'), `](${path})`);
    out = out.replace(new RegExp(`\\]\\(${escaped}(#[^)]+)\\)`, 'g'), `](${path}$1)`);
  }

  // Source file references → GitHub blob
  out = out.replace(
    /\]\((src\/[^)]+)\)/g,
    (_match, path: string) => `](${GITHUB_REPO}/blob/main/${path})`,
  );
  out = out.replace(
    /\[`(src\/[^`]+)`\]/g,
    (_match, path: string) => `[\`${path}\`](${GITHUB_REPO}/blob/main/${path})`,
  );

  // examples/ paths
  out = out.replace(
    /\]\(examples\/([^)]+)\)/g,
    (_match, path: string) => `](${GITHUB_REPO}/blob/main/examples/${path})`,
  );

  // uxp-plugin/
  out = out.replace(
    /\]\(uxp-plugin\/([^)]*)\)/g,
    (_match, path: string) => `](${GITHUB_REPO}/blob/main/uxp-plugin/${path})`,
  );

  // Strip duplicate H1 when synced readme is not the homepage
  if (localeKey !== 'en') {
    out = out.replace(/^# .+\n+/, '');
  }

  // Repo root markdown files
  out = out.replace(
    /\]\(CONTRIBUTING\.md\)/g,
    `](${GITHUB_REPO}/blob/main/CONTRIBUTING.md)`,
  );
  out = out.replace(/\]\(\.\.\/README\.md\)/g, '](/readme)');
  out = out.replace(/\]\(\.\/README\.md\)/g, '](/readme)');

  return out.trimStart();
}

function syncDocs(): void {
  const docsOut = join(CONTENT, 'docs');
  rmSync(docsOut, { recursive: true, force: true });
  ensureDir(docsOut);

  for (const file of DOC_FILES) {
    const src = join(ROOT, 'docs', file);
    if (!existsSync(src)) continue;
    const raw = readFileSync(src, 'utf8');
    const rewritten = rewriteMarkdown(raw, 'en');
    const slug = file.replace(/\.md$/, '');
    writeFileSync(join(docsOut, file), rewritten, 'utf8');

    // Fix intra-doc links in docs folder (prompt-layer.md etc.)
    const intraFixed = readFileSync(join(docsOut, file), 'utf8').replace(
      /\]\(([a-z0-9-]+)\.md(#[^)]+)?\)/gi,
      (_match, slugRef: string, anchor?: string) => {
        if (DOC_FILES.includes(`${slugRef}.md`)) {
          return `](/docs/${slugRef}${anchor ?? ''})`;
        }
        return _match;
      },
    );
    writeFileSync(join(docsOut, file), intraFixed, 'utf8');
    void slug;
  }
}

function syncReadmes(): void {
  for (const locale of LOCALES) {
    const src = join(ROOT, locale.readme);
    if (!existsSync(src)) {
      console.warn(`skip missing readme: ${locale.readme}`);
      continue;
    }
    ensureDir(locale.contentDir);
    const raw = readFileSync(src, 'utf8');
    const rewritten = rewriteMarkdown(raw, locale.key);
    const header =
      locale.key === 'en'
        ? ''
        : `# Full README\n\n> Synced from [${locale.readme}](${GITHUB_REPO}/blob/main/${locale.readme}). [Back to home](/${locale.key === 'en' ? '' : locale.key + '/'}).\n\n`;
    writeFileSync(join(locale.contentDir, 'readme.md'), header + rewritten, 'utf8');
  }
}

function cleanGenerated(): void {
  rmSync(join(CONTENT, 'readme.md'), { force: true });
  rmSync(join(CONTENT, 'docs'), { recursive: true, force: true });
  for (const locale of LOCALES) {
    if (locale.key === 'en') continue;
    rmSync(join(locale.contentDir, 'readme.md'), { force: true });
  }
}

function main(): void {
  cleanGenerated();
  copyImages();
  syncDocs();
  syncReadmes();
  console.log('site content synced (docs, readme locales, images)');
}

main();
