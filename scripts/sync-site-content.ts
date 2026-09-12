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

const SITE_URL = 'https://photoshop-mcp.com';
const GITHUB_REPO = 'https://github.com/alisaitteke/photoshop-mcp';

const LOCALES = [
  { key: 'en', contentDir: CONTENT },
  { key: 'tr', contentDir: join(CONTENT, 'tr') },
  { key: 'zh', contentDir: join(CONTENT, 'zh') },
  { key: 'es', contentDir: join(CONTENT, 'es') },
  { key: 'de', contentDir: join(CONTENT, 'de') },
  { key: 'ja', contentDir: join(CONTENT, 'ja') },
] as const;

/** README lives on GitHub only; the site links out rather than mirroring it. */
const README_LINK_MAP: Record<string, string> = {
  'README.md': `${GITHUB_REPO}#readme`,
  'README.tr.md': `${GITHUB_REPO}/blob/master/README.tr.md`,
  'README.zh-CN.md': `${GITHUB_REPO}/blob/master/README.zh-CN.md`,
  'README.es.md': `${GITHUB_REPO}/blob/master/README.es.md`,
  'README.de.md': `${GITHUB_REPO}/blob/master/README.de.md`,
  'README.ja.md': `${GITHUB_REPO}/blob/master/README.ja.md`,
};

/** repo docs/<source> → site /docs/<slug> (slug renames keep marketing-facing URLs readable). */
const DOC_FILES: Array<{ source: string; slug: string; title?: string }> = [
  { source: 'architecture.md', slug: 'architecture' },
  { source: 'available-tools.md', slug: 'available-tools' },
  { source: 'prompt-layer.md', slug: 'prompt-layer' },
  { source: 'standalone-ui.md', slug: 'web-ui' },
  { source: 'generative-ai.md', slug: 'generative-ai' },
  { source: 'development.md', slug: 'development' },
  { source: 'troubleshooting.md', slug: 'troubleshooting' },
  { source: 'anonymous-usage-analytics.md', slug: 'privacy' },
];

const DOC_SLUG_BY_SOURCE = new Map(DOC_FILES.map((d) => [d.source.replace(/\.md$/, ''), d.slug]));

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
    (_match, slug: string, anchor?: string) =>
      `](/docs/${DOC_SLUG_BY_SOURCE.get(slug) ?? slug}${anchor ?? ''})`,
  );
  out = out.replace(
    /\[`docs\/([a-z0-9-]+)\.md`\]/gi,
    (_match, slug: string) => `[\`/docs/${DOC_SLUG_BY_SOURCE.get(slug) ?? slug}\`]`,
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
    (_match, path: string) => `](${GITHUB_REPO}/blob/master/${path})`,
  );
  out = out.replace(
    /\[`(src\/[^`]+)`\]/g,
    (_match, path: string) => `[\`${path}\`](${GITHUB_REPO}/blob/master/${path})`,
  );

  // examples/ paths
  out = out.replace(
    /\]\(examples\/([^)]+)\)/g,
    (_match, path: string) => `](${GITHUB_REPO}/blob/master/examples/${path})`,
  );

  // uxp-plugin/
  out = out.replace(
    /\]\(uxp-plugin\/([^)]*)\)/g,
    (_match, path: string) => `](${GITHUB_REPO}/blob/master/uxp-plugin/${path})`,
  );

  // Strip duplicate H1 when synced readme is not the homepage
  if (localeKey !== 'en') {
    out = out.replace(/^# .+\n+/, '');
  }

  // Repo root markdown files
  out = out.replace(
    /\]\(CONTRIBUTING\.md\)/g,
    `](${GITHUB_REPO}/blob/master/CONTRIBUTING.md)`,
  );
  out = out.replace(/\]\(\.\.\/README\.md\)/g, `](${GITHUB_REPO}#readme)`);
  out = out.replace(/\]\(\.\/README\.md\)/g, `](${GITHUB_REPO}#readme)`);

  return out.trimStart();
}

function syncDocs(): void {
  const docsOut = join(CONTENT, 'docs');
  rmSync(docsOut, { recursive: true, force: true });
  ensureDir(docsOut);

  for (const { source, slug } of DOC_FILES) {
    const src = join(ROOT, 'docs', source);
    if (!existsSync(src)) {
      console.warn(`skip missing doc: ${source}`);
      continue;
    }
    const raw = readFileSync(src, 'utf8');
    let out = rewriteMarkdown(raw, 'en');

    // Intra-docs links (./prompt-layer.md → /docs/prompt-layer)
    out = out.replace(
      /\]\((?:\.\/)?([a-z0-9-]+)\.md(#[^)]+)?\)/gi,
      (match, slugRef: string, anchor?: string) => {
        const mapped = DOC_SLUG_BY_SOURCE.get(slugRef);
        return mapped ? `](/docs/${mapped}${anchor ?? ''})` : match;
      },
    );

    writeFileSync(join(docsOut, `${slug}.md`), out, 'utf8');
  }
}

/** /readme kept alive for old links; it now points at the real setup page. */
function writeReadmeRedirects(): void {
  for (const locale of LOCALES) {
    ensureDir(locale.contentDir);
    const target = '/docs/getting-started';
    const body = [
      '---',
      'title: Moved — Photoshop MCP setup',
      'description: The README page has moved. Installation now lives on the Getting started page.',
      'layout: page',
      'head:',
      '  - - meta',
      '    - name: robots',
      '      content: noindex, follow',
      `  - - link`,
      `    - rel: canonical`,
      `      href: ${SITE_URL}${target}/`,
      `  - - meta`,
      `    - http-equiv: refresh`,
      `      content: 0; url=${target}`,
      '---',
      '',
      '<div class="ps-container" style="padding-top:96px;padding-bottom:96px">',
      '',
      '# This page moved',
      '',
      `Installation instructions now live on [Getting started](${target}).`,
      '',
      `The full README stays on [GitHub](${GITHUB_REPO}#readme).`,
      '',
      '</div>',
      '',
    ].join('\n');
    writeFileSync(join(locale.contentDir, 'readme.md'), body, 'utf8');
  }
}

const GENERATED_PAGES = ['index.md', 'recipes.md', 'tools.md', 'changelog.md', 'readme.md'];


/* ── generated pages ─────────────────────────────────────────────────── */

type PageStrings = {
  landing: { title: string; description: string };
  recipes: { title: string; heading: string; lead: string; description: string };
  tools: { title: string; heading: string; lead: string; description: string };
  changelog: { title: string; heading: string; lead: string; description: string };
  gettingStarted: { title: string; heading: string; lead: string; description: string };
};

const PAGE_STRINGS: Record<string, PageStrings> = JSON.parse(
  readFileSync(join(SITE, 'i18n', 'pages.json'), 'utf8'),
);

function frontmatter(fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return ['---', ...lines, '---', ''].join('\n');
}

function writePages(): void {
  for (const locale of LOCALES) {
    ensureDir(locale.contentDir);
    const s = PAGE_STRINGS[locale.key] ?? PAGE_STRINGS.en;

    // landing
    writeFileSync(
      join(locale.contentDir, 'index.md'),
      frontmatter({ layout: 'page', title: s.landing.title, description: s.landing.description }) +
        '\n<Landing />\n',
      'utf8',
    );

    // recipes gallery
    writeFileSync(
      join(locale.contentDir, 'recipes.md'),
      frontmatter({ layout: 'page', title: s.recipes.title, description: s.recipes.description }) +
        [
          '',
          '<div class="ps-container ps-section ps-page">',
          '',
          `# ${s.recipes.heading}`,
          '',
          s.recipes.lead,
          '',
          '<RecipeGrid full />',
          '',
          '</div>',
          '',
        ].join('\n'),
      'utf8',
    );

    // tool catalog
    writeFileSync(
      join(locale.contentDir, 'tools.md'),
      frontmatter({ layout: 'page', title: s.tools.title, description: s.tools.description }) +
        [
          '',
          '<div class="ps-container ps-section ps-page">',
          '',
          `# ${s.tools.heading}`,
          '',
          s.tools.lead,
          '',
          '<ToolExplorer />',
          '',
          '</div>',
          '',
        ].join('\n'),
      'utf8',
    );
  }
}

/** CHANGELOG.md → /changelog (English source, localized shell). */
function writeChangelog(): void {
  const src = join(ROOT, 'CHANGELOG.md');
  const raw = existsSync(src) ? readFileSync(src, 'utf8') : '';
  const body = rewriteMarkdown(raw, 'en').replace(/^#\s+.*\n+/, '');

  for (const locale of LOCALES) {
    const s = PAGE_STRINGS[locale.key] ?? PAGE_STRINGS.en;
    ensureDir(locale.contentDir);
    writeFileSync(
      join(locale.contentDir, 'changelog.md'),
      frontmatter({
        title: s.changelog.title,
        description: s.changelog.description,
        editLink: 'false',
      }) +
        [
          '',
          `# ${s.changelog.heading}`,
          '',
          s.changelog.lead,
          '',
          body,
          '',
        ].join('\n'),
      'utf8',
    );
  }
}

/** One page per client, generated from the same matrix the components use. */
const CLIENT_PAGES: Array<{ id: string; name: string; blurb: string }> = [
  {
    id: 'cursor',
    name: 'Cursor',
    blurb:
      'Cursor installs MCP servers from a link. After installing, switch the chat to Agent mode — Ask mode does not call tools.',
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    blurb:
      'The quickest route for people who do not use an editor: download the bundle, double-click, done. No terminal, no Node.js.',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    blurb: 'One command adds the server. Use --scope user to keep it available in every project.',
  },
  {
    id: 'vscode',
    name: 'VS Code',
    blurb:
      'Works through Copilot Chat in Agent mode. The install link opens VS Code and asks you to confirm.',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    blurb: 'Windsurf reads a JSON config file. Cascade picks the tools up after a reload.',
  },
  {
    id: 'zed',
    name: 'Zed',
    blurb:
      'Zed calls MCP servers context servers. Add it as a local server from the settings UI, or paste the snippet into settings.json.',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    blurb: 'Add it with the CLI, or write the TOML block yourself. Codex speaks stdio, which is what this server uses.',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    blurb:
      'Google\u2019s IDE and its agy CLI share one MCP config file. This is where Gemini CLI users should go after the June 2026 transition.',
  },
  {
    id: 'other',
    name: 'Other clients',
    blurb:
      'Anything that runs local MCP servers over stdio works. Cline, Kiro, JetBrains AI Assistant, Warp, Goose, LM Studio, Raycast, opencode, Trae and Visual Studio are all in the picker on the setup page.',
  },
];


/** The conversion page: client picker + verification + first prompts. Localized. */
const FIRST_PROMPTS = [
  'Remove the background from the active layer and keep the original pixels behind a mask.',
  'Resize this document to 1080x1350, sharpen it, and export an optimized JPEG.',
  'Organize the layer stack: rename layers by kind and group related ones.',
];

const GS_BODY: Record<string, { docsNote: string; nextItems: string[] }> = {
  en: {
    docsNote: '',
    nextItems: [
      '[Recipes](/recipes) — sixteen ready-made workflows, each one undo step.',
      '[Tool catalog](/tools) — every tool, searchable.',
      '[Web UI](/docs/web-ui) — run it without an editor.',
      '[Troubleshooting](/docs/troubleshooting) — when Photoshop does not answer.',
    ],
  },
  tr: {
    docsNote: 'Ayrıntılı dokümantasyon İngilizcedir.',
    nextItems: [
      '[Tarifler](/tr/recipes) — on altı hazır iş akışı, her biri tek geri alma adımı.',
      '[Araç kataloğu](/tr/tools) — tüm araçlar, aranabilir.',
      '[Web arayüzü](/docs/web-ui) — editör olmadan çalıştırın.',
      '[Sorun giderme](/docs/troubleshooting) — Photoshop yanıt vermediğinde.',
    ],
  },
  zh: {
    docsNote: '详细文档为英文。',
    nextItems: [
      '[配方](/zh/recipes) — 十六个开箱即用流程，每个只占一步撤销。',
      '[工具目录](/zh/tools) — 全部工具，可搜索。',
      '[Web 界面](/docs/web-ui) — 不用编辑器也能运行。',
      '[疑难解答](/docs/troubleshooting) — 当 Photoshop 没有响应时。',
    ],
  },
  es: {
    docsNote: 'La documentación detallada está en inglés.',
    nextItems: [
      '[Recetas](/es/recipes) — dieciséis flujos listos, cada uno en un paso de deshacer.',
      '[Catálogo de herramientas](/es/tools) — todas las herramientas, buscables.',
      '[Interfaz web](/docs/web-ui) — úsalo sin editor.',
      '[Solución de problemas](/docs/troubleshooting) — cuando Photoshop no responde.',
    ],
  },
  de: {
    docsNote: 'Die ausführliche Dokumentation ist auf Englisch.',
    nextItems: [
      '[Rezepte](/de/recipes) — sechzehn fertige Abläufe, je ein Rückgängig-Schritt.',
      '[Werkzeugkatalog](/de/tools) — alle Werkzeuge, durchsuchbar.',
      '[Web-Oberfläche](/docs/web-ui) — ohne Editor nutzen.',
      '[Fehlerbehebung](/docs/troubleshooting) — wenn Photoshop nicht antwortet.',
    ],
  },
  ja: {
    docsNote: '詳しいドキュメントは英語です。',
    nextItems: [
      '[レシピ](/ja/recipes) — すぐ使える 16 のワークフロー。どれも取り消し 1 回分。',
      '[ツールカタログ](/ja/tools) — 全ツールを検索できます。',
      '[Web UI](/docs/web-ui) — エディタなしで動かす。',
      '[トラブルシューティング](/docs/troubleshooting) — Photoshop が応答しないとき。',
    ],
  },
};

function writeGettingStarted(): void {
  const i18n: Record<string, { gs: { prereqTitle: string; prereqs: string[]; pickClient: string; firstPrompts: string; next: string } }> =
    {};
  for (const locale of LOCALES) {
    i18n[locale.key] = JSON.parse(readFileSync(join(SITE, 'i18n', `${locale.key}.json`), 'utf8'));
  }

  for (const locale of LOCALES) {
    const s = PAGE_STRINGS[locale.key] ?? PAGE_STRINGS.en;
    const g = i18n[locale.key].gs;
    const extra = GS_BODY[locale.key] ?? GS_BODY.en;
    const dir = join(locale.contentDir, 'docs');
    ensureDir(dir);

    const lines = [
      '',
      `# ${s.gettingStarted.heading}`,
      '',
      s.gettingStarted.lead,
      '',
      ...(extra.docsNote ? [`> ${extra.docsNote}`, ''] : []),
      `## ${g.prereqTitle}`,
      '',
      ...g.prereqs.map((x) => `- ${x}`),
      '',
      `## ${g.pickClient}`,
      '',
      '<ClientPicker />',
      '',
      `## ${g.firstPrompts}`,
      '',
      ...FIRST_PROMPTS.flatMap((prompt) => ['```text', prompt, '```', '']),
      `## ${g.next}`,
      '',
      ...extra.nextItems.map((x) => `- ${x}`),
      '',
    ];

    writeFileSync(
      join(dir, 'getting-started.md'),
      frontmatter({ title: s.gettingStarted.title, description: s.gettingStarted.description }) +
        lines.join('\n'),
      'utf8',
    );
  }
}

function writeClientDocs(): void {
  const dir = join(CONTENT, 'docs', 'clients');
  ensureDir(dir);
  for (const client of CLIENT_PAGES) {
    const title = `${client.name} + Photoshop MCP setup`;
    const body =
      frontmatter({
        title,
        description: `Connect Adobe Photoshop to ${client.name} with Photoshop MCP. Install link, config snippet, file paths for macOS and Windows, and how to verify it works.`,
      }) +
      [
        '',
        `# ${client.name}`,
        '',
        client.blurb,
        '',
        `<ClientDoc id="${client.id}" />`,
        '',
        '## Before you start',
        '',
        '- Adobe Photoshop installed and open (macOS or Windows).',
        '- Node.js 18 or newer, unless you use the Claude Desktop bundle.',
        '',
        '## Next',
        '',
        '- [Recipes](/recipes) — sixteen ready-made workflows with prompts you can copy.',
        '- [Tool catalog](/tools) — every tool, searchable.',
        '- [Troubleshooting](/docs/troubleshooting) — when Photoshop does not answer.',
        '',
      ].join('\n');
    writeFileSync(join(dir, `${client.id}.md`), body, 'utf8');
  }
}

function cleanGenerated(): void {
  rmSync(join(CONTENT, 'docs'), { recursive: true, force: true });
  for (const locale of LOCALES) {
    for (const page of GENERATED_PAGES) {
      rmSync(join(locale.contentDir, page), { force: true });
    }
    if (locale.key !== 'en') rmSync(join(locale.contentDir, 'docs'), { recursive: true, force: true });
  }
}

function main(): void {
  cleanGenerated();
  copyImages();
  syncDocs();
  writeReadmeRedirects();
  writeGettingStarted();
  writeClientDocs();
  writePages();
  writeChangelog();
  console.log('site content synced (docs, client pages, landing pages, changelog, images)');
}

main();
