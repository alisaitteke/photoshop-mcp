<script setup lang="ts">
import meta from '../../../data/meta.json';
import { GITHUB, PACKAGE } from '../../../data/clients';
import { useSiteI18n } from '../composables/useSiteI18n';

const { t, link } = useSiteI18n();
/** Bound, not literal: a literal src would be resolved as a build-time import. */
const LOGO = '/ps-logo-icon.svg';
const LOCALES = [
  { key: 'en', label: 'English', path: '/' },
  { key: 'tr', label: 'Türkçe', path: '/tr/' },
  { key: 'zh', label: '简体中文', path: '/zh/' },
  { key: 'es', label: 'Español', path: '/es/' },
  { key: 'de', label: 'Deutsch', path: '/de/' },
  { key: 'ja', label: '日本語', path: '/ja/' },
];
</script>

<template>
  <footer class="ft">
    <div class="ps-container ft-grid">
      <div class="ft-brand">
        <a :href="link('/')" class="ft-logo">
          <img :src="LOGO" alt="" width="28" height="28" />
          <span>Photoshop MCP</span>
        </a>
        <p class="ft-disclaimer">{{ t.footer.disclaimer }}</p>
        <p class="ft-meta">
          <code>{{ PACKAGE }}</code> · v{{ meta.version }} · {{ t.footer.license }}
        </p>
      </div>
      <nav class="ft-col" :aria-label="t.footer.product">
        <h4>{{ t.footer.product }}</h4>
        <a :href="link('/docs/getting-started')">{{ t.footer.gettingStarted }}</a>
        <a :href="link('/recipes')">{{ t.footer.recipes }}</a>
        <a :href="link('/tools')">{{ t.footer.tools }}</a>
        <a href="/docs/web-ui">{{ t.footer.webUi }}</a>
        <a :href="link('/changelog')">{{ t.footer.changelog }}</a>
      </nav>
      <nav class="ft-col" :aria-label="t.footer.docs">
        <h4>{{ t.footer.docs }}</h4>
        <a href="/docs/troubleshooting">{{ t.footer.troubleshooting }}</a>
        <a href="/docs/prompt-layer">Prompts &amp; agents</a>
        <a href="/docs/generative-ai">Generative AI</a>
        <a href="/docs/architecture">{{ t.footer.architecture }}</a>
        <a href="/docs/privacy">{{ t.footer.privacy }}</a>
      </nav>
      <nav class="ft-col" :aria-label="t.footer.community">
        <h4>{{ t.footer.community }}</h4>
        <a :href="GITHUB" target="_blank" rel="noopener">GitHub</a>
        <a :href="`https://www.npmjs.com/package/${PACKAGE}`" target="_blank" rel="noopener">npm</a>
        <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener">MCP Registry</a>
        <a :href="`${GITHUB}/issues`" target="_blank" rel="noopener">{{ t.footer.issues }}</a>
      </nav>
    </div>
    <div class="ps-container ft-bottom">
      <p>
        {{ t.footer.builtBy }}
        <a href="https://alisait.com" target="_blank" rel="noopener">Ali Sait Teke</a>
        · <a href="https://www.linkedin.com/in/alisait/" target="_blank" rel="noopener">LinkedIn</a>
      </p>
      <ul class="ft-locales">
        <li v-for="l in LOCALES" :key="l.key"><a :href="l.path" :lang="l.key">{{ l.label }}</a></li>
      </ul>
    </div>
  </footer>
</template>

<style scoped>
.ft {
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  padding: 56px 0 28px;
  font-size: var(--ps-text-sm);
}
.ft-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr));
  gap: 32px;
}
@media (max-width: 860px) {
  .ft-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ft-brand {
    grid-column: 1 / -1;
  }
}
.ft-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.ft-disclaimer {
  margin: 14px 0 0;
  color: var(--vp-c-text-2);
  max-width: 44ch;
  line-height: 1.55;
}
.ft-meta {
  margin: 10px 0 0;
  color: var(--vp-c-text-3);
  font-size: var(--ps-text-xs);
}
.ft-meta code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
}
.ft-col {
  display: grid;
  gap: 8px;
  align-content: start;
}
.ft-col h4 {
  margin: 0 0 4px;
  font-size: var(--ps-text-sm);
  font-weight: 600;
}
.ft-col a,
.ft-bottom a {
  color: var(--vp-c-text-2);
  text-decoration: none;
}
.ft-col a:hover,
.ft-bottom a:hover {
  color: var(--vp-c-brand-1);
}
.ft-bottom {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--vp-c-divider);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  color: var(--vp-c-text-3);
  font-size: var(--ps-text-xs);
}
.ft-bottom p {
  margin: 0;
}
.ft-locales {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
</style>
