import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type DefaultTheme } from 'vitepress';

const SITE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(SITE_DIR, '..');
const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
const meta = JSON.parse(readFileSync(join(SITE_DIR, 'data', 'meta.json'), 'utf8')) as {
  toolsTotal: number;
  toolsAtomic: number;
  toolsRecipes: number;
};
const en = JSON.parse(readFileSync(join(SITE_DIR, 'i18n', 'en.json'), 'utf8')) as {
  faq: { items: Array<{ q: string; a: string }> };
};

const SITE_URL = 'https://photoshop-mcp.com';
const OG_IMAGE = `${SITE_URL}/images/og-social.png`;
const LLMS_URL = `${SITE_URL}/llms.txt`;
const LLMS_FULL_URL = `${SITE_URL}/llms-full.txt`;
const REPO = 'https://github.com/alisaitteke/photoshop-mcp';
const NPM = 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp';

const SITE_NAME = 'Photoshop MCP';
const DEFAULT_TITLE = 'Photoshop MCP — Tell Photoshop what you want';
const DEFAULT_DESCRIPTION = `Connect Claude, Cursor and any MCP client to Adobe Photoshop. ${meta.toolsTotal} tools and ${meta.toolsRecipes} one-step recipes for background removal, retouching, color grading and batch export. macOS and Windows.`;
const KEYWORDS =
  'photoshop mcp, cursor photoshop, claude photoshop, adobe photoshop automation, model context protocol, mcp server, ai photoshop, remove background, generative fill';

const LOCALES = ['en', 'tr', 'zh', 'es', 'de', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

/** Pages that exist in every language (docs stay English). */
const TRANSLATED_PAGES = ['index', 'recipes', 'tools', 'changelog', 'docs/getting-started'];

function hreflangTags(): Array<[string, Record<string, string>]> {
  const tags: Array<[string, Record<string, string>]> = [];
  for (const page of TRANSLATED_PAGES) {
    for (const locale of LOCALES) {
      const prefix = locale === 'en' ? '' : `/${locale}`;
      const pagePath = page === 'index' ? prefix || '/' : `${prefix}/${page}`;
      const href = pagePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${pagePath.replace(/\/$/, '')}/`;
      tags.push(['link', { rel: 'alternate', hreflang: locale === 'zh' ? 'zh-CN' : locale, href }]);
    }
    tags.push([
      'link',
      {
        rel: 'alternate',
        hreflang: 'x-default',
        href: page === 'index' ? `${SITE_URL}/` : `${SITE_URL}/${page}/`,
      },
    ]);
  }
  return tags;
}

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Windows, macOS',
  description: DEFAULT_DESCRIPTION,
  url: SITE_URL,
  downloadUrl: NPM,
  codeRepository: REPO,
  softwareHelp: `${SITE_URL}/docs/troubleshooting/`,
  screenshot: OG_IMAGE,
  softwareVersion: pkg.version,
  license: 'https://opensource.org/licenses/MIT',
  author: { '@type': 'Person', name: 'Ali Sait Teke', url: 'https://alisait.com' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: en.faq.items.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Install Photoshop MCP',
  description: 'Connect Adobe Photoshop to Claude, Cursor or any other MCP client.',
  totalTime: 'PT2M',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Install the server',
      text: 'Use the one-click install link for your client, or run: npx -y @alisaitteke/photoshop-mcp',
      url: `${SITE_URL}/docs/getting-started/`,
    },
    {
      '@type': 'HowToStep',
      name: 'Open Photoshop',
      text: 'Launch Adobe Photoshop (2012 or newer) on macOS or Windows.',
    },
    {
      '@type': 'HowToStep',
      name: 'Send a prompt',
      text: 'Ask your assistant: "Ping Photoshop and list open documents."',
    },
  ],
};

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;

function breadcrumbJsonLd(pageData: {
  relativePath: string;
  title?: string;
  frontmatter: Record<string, unknown>;
}): [string, Record<string, string>, string] | null {
  if (!pageData.relativePath.startsWith('docs/')) return null;
  const slug = pageData.relativePath.replace(/\.md$/, '');
  const title = (pageData.frontmatter.title as string | undefined) ?? pageData.title ?? slug;
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Documentation',
        item: `${SITE_URL}/docs/getting-started/`,
      },
      { '@type': 'ListItem', position: 3, name: title, item: `${SITE_URL}/${slug}/` },
    ],
  };
  return ['script', { type: 'application/ld+json' }, JSON.stringify(json)];
}

const RYBBIT_LOCALHOST_GUARD =
  "(function(){var h=location.hostname;if(h==='localhost'||h==='127.0.0.1'||h==='::1'){window.__RYBBIT_OPTOUT__=true;try{localStorage.setItem('disable-rybbit','true')}catch(e){}}})();";

const sharedHead: Array<[string, Record<string, string> | string]> = [
  ['link', { rel: 'icon', href: '/ps-logo-icon.svg', type: 'image/svg+xml' }],
  ['link', { rel: 'apple-touch-icon', href: `${SITE_URL}/images/og-social.png` }],
  ['link', { rel: 'describedby', href: LLMS_URL, type: 'text/plain' }],
  ['link', { rel: 'alternate', href: LLMS_URL, type: 'text/plain', title: 'llms.txt' }],
  ['link', { rel: 'alternate', href: LLMS_FULL_URL, type: 'text/plain', title: 'llms-full.txt' }],
  ['meta', { name: 'keywords', content: KEYWORDS }],
  ['meta', { name: 'author', content: 'Ali Sait Teke' }],
  ['meta', { name: 'robots', content: 'index, follow, max-image-preview:large' }],
  ['meta', { name: 'theme-color', content: '#0a1020' }],
  ['meta', { property: 'og:site_name', content: SITE_NAME }],
  ['meta', { property: 'og:locale', content: 'en_US' }],
  ['meta', { property: 'og:image', content: OG_IMAGE }],
  ['meta', { property: 'og:image:width', content: '1200' }],
  ['meta', { property: 'og:image:height', content: '630' }],
  ['meta', { property: 'og:image:alt', content: 'Photoshop MCP — tell Photoshop what you want' }],
  ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ['meta', { name: 'twitter:image', content: OG_IMAGE }],
  ['meta', { name: 'twitter:image:alt', content: 'Photoshop MCP — tell Photoshop what you want' }],
  ['script', { type: 'application/ld+json' }, JSON.stringify(softwareJsonLd)],
  ['script', { type: 'application/ld+json' }, JSON.stringify(howToJsonLd)],
  ['script', {}, RYBBIT_LOCALHOST_GUARD],
  [
    'script',
    {
      src: 'https://hey.sideguard.io/api/script.js',
      'data-site-id': '5e488c650441',
      defer: '',
    },
  ],
  ...(googleVerification
    ? ([['meta', { name: 'google-site-verification', content: googleVerification }]] as const)
    : []),
  ...hreflangTags(),
];

function pageOgTitle(pageData: { title?: string; frontmatter: Record<string, unknown> }): string {
  const fmTitle = pageData.frontmatter.title as string | undefined;
  if (fmTitle) return fmTitle;
  if (pageData.title) return `${pageData.title} | ${SITE_NAME}`;
  return DEFAULT_TITLE;
}

function pageOgDescription(pageData: {
  description?: string;
  frontmatter: Record<string, unknown>;
}): string {
  const fmDesc = pageData.frontmatter.description as string | undefined;
  if (fmDesc) return fmDesc;
  if (pageData.description) return pageData.description;
  return DEFAULT_DESCRIPTION;
}

/* ── navigation ─────────────────────────────────────────────────────────── */

const NAV_STRINGS: Record<Locale, { docs: string; recipes: string; tools: string; changelog: string }> = {
  en: { docs: 'Docs', recipes: 'Recipes', tools: 'Tools', changelog: 'Changelog' },
  tr: { docs: 'Dokümantasyon', recipes: 'Tarifler', tools: 'Araçlar', changelog: 'Sürüm notları' },
  zh: { docs: '文档', recipes: '配方', tools: '工具', changelog: '更新日志' },
  es: { docs: 'Docs', recipes: 'Recetas', tools: 'Herramientas', changelog: 'Cambios' },
  de: { docs: 'Doku', recipes: 'Rezepte', tools: 'Tools', changelog: 'Änderungen' },
  ja: { docs: 'ドキュメント', recipes: 'レシピ', tools: 'ツール', changelog: '変更履歴' },
};

function nav(locale: Locale): DefaultTheme.NavItem[] {
  const p = locale === 'en' ? '' : `/${locale}`;
  const s = NAV_STRINGS[locale];
  return [
    { text: s.docs, link: `${p}/docs/getting-started`, activeMatch: `^${p}/docs/` },
    { text: s.recipes, link: `${p}/recipes` },
    { text: s.tools, link: `${p}/tools` },
    { text: s.changelog, link: `${p}/changelog` },
  ];
}

const docsSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Start here',
    items: [
      { text: 'Getting started', link: '/docs/getting-started' },
      { text: 'Recipes', link: '/recipes' },
      { text: 'Tool catalog', link: '/tools' },
    ],
  },
  {
    text: 'Clients',
    items: [
      { text: 'Cursor', link: '/docs/clients/cursor' },
      { text: 'Claude Desktop', link: '/docs/clients/claude-desktop' },
      { text: 'Claude Code', link: '/docs/clients/claude-code' },
      { text: 'VS Code', link: '/docs/clients/vscode' },
      { text: 'Windsurf', link: '/docs/clients/windsurf' },
      { text: 'Zed', link: '/docs/clients/zed' },
      { text: 'Codex CLI', link: '/docs/clients/codex' },
      { text: 'Antigravity', link: '/docs/clients/antigravity' },
      { text: 'Other clients', link: '/docs/clients/other' },
    ],
  },
  {
    text: 'Guides',
    items: [
      { text: 'Web UI', link: '/docs/web-ui' },
      { text: 'Generative AI', link: '/docs/generative-ai' },
      { text: 'Prompts & agents', link: '/docs/prompt-layer' },
      { text: 'Tool reference', link: '/docs/available-tools' },
      { text: 'Troubleshooting', link: '/docs/troubleshooting' },
    ],
  },
  {
    text: 'Advanced',
    collapsed: true,
    items: [
      { text: 'Architecture', link: '/docs/architecture' },
      { text: 'Development', link: '/docs/development' },
      { text: 'Privacy & analytics', link: '/docs/privacy' },
    ],
  },
];

/** Non-English locales get a translated setup page; the rest of the docs stay English. */
function localeSidebar(locale: Locale): DefaultTheme.Sidebar {
  if (locale === 'en') return { '/docs/': docsSidebar };
  const p = `/${locale}`;
  return {
    [`${p}/docs/`]: [
      {
        text: NAV_STRINGS[locale].docs,
        items: [
          { text: 'Getting started', link: `${p}/docs/getting-started` },
          { text: NAV_STRINGS[locale].recipes, link: `${p}/recipes` },
          { text: NAV_STRINGS[locale].tools, link: `${p}/tools` },
          { text: 'All documentation (English)', link: '/docs/getting-started' },
        ],
      },
    ],
    '/docs/': docsSidebar,
  };
}

function localeTheme(locale: Locale): { themeConfig: DefaultTheme.Config } {
  const p = locale === 'en' ? '' : `/${locale}`;
  return {
    themeConfig: {
      logo: '/ps-logo-icon.svg',
      siteTitle: 'Photoshop MCP',
      socialLinks: [{ icon: 'github', link: REPO }],
      nav: nav(locale),
      sidebar: localeSidebar(locale),
      search: { provider: 'local' },
      outline: { level: [2, 3] },
      docFooter: { prev: false, next: false },
      editLink: {
        pattern: `${REPO}/edit/master/site/content/:path`,
        text: 'Edit this page on GitHub',
      },
      // Docs exist only in English, so the language switcher goes to the locale home
      // instead of mapping the current path into a locale that has no such page.
      i18nRouting: false,
    },
  };
}

export default defineConfig({
  title: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
  lang: 'en-US',
  srcDir: 'content',
  cleanUrls: true,
  lastUpdated: true,
  base: '/',
  outDir: '.vitepress/dist',
  appearance: 'dark',
  metaChunk: true,

  head: sharedHead,

  themeConfig: localeTheme('en').themeConfig,

  locales: {
    root: { label: 'English', lang: 'en', link: '/', ...localeTheme('en') },
    tr: {
      label: 'Türkçe',
      lang: 'tr',
      link: '/tr/',
      description:
        'Photoshop’a ne istediğinizi yazın. Claude, Cursor ve diğer MCP istemcilerini Adobe Photoshop’a bağlayan açık kaynak sunucu.',
      ...localeTheme('tr'),
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      description:
        '把想做的事告诉 Photoshop。将 Claude、Cursor 等 MCP 客户端连接到 Adobe Photoshop 的开源服务器。',
      ...localeTheme('zh'),
    },
    es: {
      label: 'Español',
      lang: 'es',
      link: '/es/',
      description:
        'Dile a Photoshop lo que quieres. Servidor de código abierto que conecta Claude, Cursor y cualquier cliente MCP con Adobe Photoshop.',
      ...localeTheme('es'),
    },
    de: {
      label: 'Deutsch',
      lang: 'de',
      link: '/de/',
      description:
        'Sag Photoshop, was du willst. Open-Source-Server, der Claude, Cursor und jeden MCP-Client mit Adobe Photoshop verbindet.',
      ...localeTheme('de'),
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      link: '/ja/',
      description:
        'やりたいことを Photoshop に伝えるだけ。Claude や Cursor などの MCP クライアントと Adobe Photoshop をつなぐオープンソースサーバー。',
      ...localeTheme('ja'),
    },
  },

  vite: {
    // srcDir is `content/`, so Vite's default publicDir would miss `site/public/`.
    publicDir: join(SITE_DIR, 'public'),
    plugins: [
      {
        // Files under site/public are served as-is; keep Rollup from trying to bundle them.
        name: 'vitepress-public-assets',
        enforce: 'pre',
        resolveId(source) {
          if (source.startsWith('/images/')) {
            return { id: source, external: true };
          }
        },
      },
    ],
  },

  transformPageData(pageData) {
    const canonical =
      pageData.relativePath === 'index.md'
        ? `${SITE_URL}/`
        : `${SITE_URL}/${pageData.relativePath.replace(/\.md$/, '').replace(/\/index$/, '')}/`;
    const ogTitle = pageOgTitle(pageData);
    const ogDescription = pageOgDescription(pageData);
    const ogType = pageData.relativePath.startsWith('docs/') ? 'article' : 'website';

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { property: 'og:type', content: ogType }],
      ['meta', { property: 'og:title', content: ogTitle }],
      ['meta', { property: 'og:description', content: ogDescription }],
      ['meta', { name: 'twitter:title', content: ogTitle }],
      ['meta', { name: 'twitter:description', content: ogDescription }],
      ['meta', { name: 'description', content: ogDescription }]
    );

    // FAQ rich result belongs to the landing pages only.
    if (/^(?:[a-z]{2}\/)?index\.md$/.test(pageData.relativePath)) {
      pageData.frontmatter.head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify(faqJsonLd),
      ]);
    }

    const breadcrumb = breadcrumbJsonLd(pageData);
    if (breadcrumb) pageData.frontmatter.head.push(breadcrumb);
  },
});
