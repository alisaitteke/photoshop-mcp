import { defineConfig } from 'vitepress';

const SITE_URL = 'https://alisaitteke.github.io/photoshop-mcp';
const OG_IMAGE = `${SITE_URL}/images/og-social.png`;

const LOCALES = ['en', 'tr', 'zh', 'es', 'de', 'ja'] as const;

const HREFLANG_PATHS = [
  { path: '/', pages: ['index'] },
  { path: '/readme', pages: ['readme'] },
];

function hreflangTags(): Array<[string, Record<string, string>]> {
  const tags: Array<[string, Record<string, string>]> = [];
  for (const { path, pages } of HREFLANG_PATHS) {
    for (const page of pages) {
      for (const locale of LOCALES) {
        const prefix = locale === 'en' ? '' : `/${locale}`;
        const pagePath = page === 'index' ? prefix || '/' : `${prefix}/${page}`;
        const href =
          pagePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${pagePath.replace(/\/$/, '')}/`;
        tags.push([
          'link',
          {
            rel: 'alternate',
            hreflang: locale === 'zh' ? 'zh-CN' : locale,
            href,
          },
        ]);
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
  }
  return tags;
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Photoshop MCP',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Windows, macOS',
  description:
    'MCP server for Adobe Photoshop — 102 tools, generative AI, recipe workflows, and standalone web UI. Control Photoshop from Cursor, Claude, or natural language.',
  url: SITE_URL,
  downloadUrl: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp',
  softwareVersion: '1.6.1',
  author: {
    '@type': 'Person',
    name: 'Ali Sait Teke',
    url: 'https://alisait.com',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

const sharedHead: Array<[string, Record<string, string> | string]> = [
  ['link', { rel: 'icon', href: '/ps-logo-icon.svg', type: 'image/svg+xml' }],
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:image', content: OG_IMAGE }],
  ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ['meta', { name: 'twitter:image', content: OG_IMAGE }],
  ['script', { type: 'application/ld+json' }, JSON.stringify(jsonLd)],
  ...hreflangTags(),
];

const docsSidebar = [
  {
    text: 'Documentation',
    items: [
      { text: 'Architecture', link: '/docs/architecture' },
      { text: 'Available Tools', link: '/docs/available-tools' },
      { text: 'Prompt Layer', link: '/docs/prompt-layer' },
      { text: 'Development', link: '/docs/development' },
      { text: 'Troubleshooting', link: '/docs/troubleshooting' },
      { text: 'Usage Analytics', link: '/docs/anonymous-usage-analytics' },
    ],
  },
];

export default defineConfig({
  title: 'Photoshop MCP',
  description:
    'Control Adobe Photoshop with AI — MCP server for Cursor, Claude Desktop, and natural language. 102 tools, recipes, standalone web UI.',
  lang: 'en-US',
  srcDir: 'content',
  cleanUrls: true,
  lastUpdated: true,
  base: '/photoshop-mcp/',
  outDir: '.vitepress/dist',

  head: sharedHead,

  themeConfig: {
    logo: '/ps-logo-icon.svg',
    siteTitle: 'Photoshop MCP',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/alisaitteke/photoshop-mcp' },
    ],

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Full README', link: '/readme' },
      { text: 'Docs', link: '/docs/architecture' },
      {
        text: 'Links',
        items: [
          { text: 'npm', link: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp' },
          { text: 'MCP Registry', link: 'https://registry.modelcontextprotocol.io' },
          { text: 'GitHub', link: 'https://github.com/alisaitteke/photoshop-mcp' },
        ],
      },
    ],

    sidebar: {
      '/docs/': docsSidebar,
    },

    footer: {
      message: 'Unofficial project — not affiliated with Adobe Inc.',
      copyright: 'MIT License · Ali Sait Teke',
    },

    editLink: {
      pattern: 'https://github.com/alisaitteke/photoshop-mcp/edit/main/:path',
      text: 'Edit this page on GitHub',
    },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      link: '/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Full README', link: '/readme' },
          { text: 'Docs', link: '/docs/architecture' },
          {
            text: 'Links',
            items: [
              { text: 'npm', link: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp' },
              { text: 'MCP Registry', link: 'https://registry.modelcontextprotocol.io' },
              { text: 'GitHub', link: 'https://github.com/alisaitteke/photoshop-mcp' },
            ],
          },
        ],
      },
    },
    tr: {
      label: 'Türkçe',
      lang: 'tr',
      link: '/tr/',
      description:
        'Adobe Photoshop\'u yapay zeka ile kontrol edin — Cursor, Claude ve doğal dil için MCP sunucusu.',
      themeConfig: {
        nav: [
          { text: 'Ana Sayfa', link: '/tr/' },
          { text: 'Tam README', link: '/tr/readme' },
          { text: 'Dokümantasyon', link: '/docs/architecture' },
          {
            text: 'Bağlantılar',
            items: [
              { text: 'npm', link: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp' },
              { text: 'GitHub', link: 'https://github.com/alisaitteke/photoshop-mcp' },
            ],
          },
        ],
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      description: '用 AI 控制 Adobe Photoshop — 适用于 Cursor、Claude 的 MCP 服务器。',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '完整 README', link: '/zh/readme' },
          { text: '文档', link: '/docs/architecture' },
          {
            text: '链接',
            items: [
              { text: 'npm', link: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp' },
              { text: 'GitHub', link: 'https://github.com/alisaitteke/photoshop-mcp' },
            ],
          },
        ],
      },
    },
    es: {
      label: 'Español',
      lang: 'es',
      link: '/es/',
      description:
        'Controla Adobe Photoshop con IA — servidor MCP para Cursor, Claude y lenguaje natural.',
      themeConfig: {
        nav: [
          { text: 'Inicio', link: '/es/' },
          { text: 'README completo', link: '/es/readme' },
          { text: 'Documentación', link: '/docs/architecture' },
          {
            text: 'Enlaces',
            items: [
              { text: 'npm', link: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp' },
              { text: 'GitHub', link: 'https://github.com/alisaitteke/photoshop-mcp' },
            ],
          },
        ],
      },
    },
    de: {
      label: 'Deutsch',
      lang: 'de',
      link: '/de/',
      description:
        'Adobe Photoshop mit KI steuern — MCP-Server für Cursor, Claude und natürliche Sprache.',
      themeConfig: {
        nav: [
          { text: 'Start', link: '/de/' },
          { text: 'Vollständiges README', link: '/de/readme' },
          { text: 'Dokumentation', link: '/docs/architecture' },
          {
            text: 'Links',
            items: [
              { text: 'npm', link: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp' },
              { text: 'GitHub', link: 'https://github.com/alisaitteke/photoshop-mcp' },
            ],
          },
        ],
      },
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      link: '/ja/',
      description:
        'AIでAdobe Photoshopを操作 — Cursor、Claude向けMCPサーバー。',
      themeConfig: {
        nav: [
          { text: 'ホーム', link: '/ja/' },
          { text: 'README全文', link: '/ja/readme' },
          { text: 'ドキュメント', link: '/docs/architecture' },
          {
            text: 'リンク',
            items: [
              { text: 'npm', link: 'https://www.npmjs.com/package/@alisaitteke/photoshop-mcp' },
              { text: 'GitHub', link: 'https://github.com/alisaitteke/photoshop-mcp' },
            ],
          },
        ],
      },
    },
  },

  vite: {
    plugins: [
      {
        name: 'vitepress-public-images',
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
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:url', content: canonical }],
    );
  },
});
