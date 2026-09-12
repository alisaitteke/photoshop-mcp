<script setup lang="ts">
import meta from '../../../data/meta.json';
import { GITHUB, LOGO_CLIENTS, UI_COMMAND } from '../../../data/clients';
import { useSiteI18n } from '../composables/useSiteI18n';
import InstallStrip from './InstallStrip.vue';
import PromptCard from './PromptCard.vue';
import RecipeGrid from './RecipeGrid.vue';
import ToolExplorer from './ToolExplorer.vue';
import FaqList from './FaqList.vue';
import CommandBlock from './CommandBlock.vue';
import Icon from './Icon.vue';

const { t, fmt, link } = useSiteI18n();

const UI_SHOT = '/images/frame_generic_light.png';

const SAMPLE = `{
  "ok": true,
  "summary": "Background removed",
  "undo_history_states_consumed": 1,
  "details": {
    "method": "select_subject",
    "mask_layer": "Portrait",
    "feather_px": 2
  }
}`;
</script>

<template>
  <div class="lp">
    <!-- 1 · hero -->
    <section class="hero">
      <div class="ps-container hero-grid">
        <div class="hero-copy">
          <h1 class="hero-title">{{ t.hero.title }}</h1>
          <p class="hero-lead">{{ t.hero.lead }}</p>
          <InstallStrip />
          <p class="hero-trust">{{ t.hero.trust }}</p>
        </div>
        <div class="hero-demo">
          <PromptCard />
        </div>
      </div>
    </section>

    <!-- 2 · works with -->
    <section class="ps-section works">
      <div class="ps-container">
        <h2 class="works-title">{{ t.works.title }}</h2>
        <ul class="works-list">
          <li v-for="c in LOGO_CLIENTS" :key="c.id">{{ c.name }}</li>
          <li class="works-more">{{ t.works.more }}</li>
        </ul>
      </div>
    </section>

    <!-- 3 · how it works -->
    <section class="ps-section">
      <div class="ps-container">
        <div class="ps-section-head">
          <h2 class="ps-h2">{{ t.how.title }}</h2>
        </div>
        <ol class="steps">
          <li v-for="(s, i) in t.how.steps" :key="s.title" class="step">
            <span class="step-n">{{ i + 1 }}</span>
            <h3 class="step-title">{{ s.title }}</h3>
            <p class="step-text">{{ s.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- 4 · recipes -->
    <section class="ps-section">
      <div class="ps-container">
        <div class="ps-section-head recipes-head">
          <div>
            <h2 class="ps-h2">{{ t.recipes.title }}</h2>
            <p class="ps-lead">{{ t.recipes.lead }}</p>
          </div>
          <a :href="link('/recipes')" class="ps-btn ps-btn-secondary">{{ t.recipes.seeAll }}</a>
        </div>
        <RecipeGrid :limit="8" />
      </div>
    </section>

    <!-- 5 · two ways to run -->
    <section class="ps-section">
      <div class="ps-container">
        <div class="ps-section-head">
          <h2 class="ps-h2">{{ t.run.title }}</h2>
        </div>
        <div class="run-grid">
          <article class="run-card">
            <h3 class="run-title">{{ t.run.ide.title }}</h3>
            <p class="run-text">{{ fmt(t.run.ide.text, { n: meta.toolsTotal }) }}</p>
            <InstallStrip class="run-strip" />
            <a :href="link('/docs/getting-started')" class="run-link">
              {{ t.run.ide.link }} <Icon name="arrow" :size="14" />
            </a>
          </article>
          <article class="run-card">
            <h3 class="run-title">{{ t.run.ui.title }}</h3>
            <p class="run-text">{{ t.run.ui.text }}</p>
            <CommandBlock :command="UI_COMMAND" cta="landing:web-ui" />
            <img
              :src="UI_SHOT"
              :alt="t.run.ui.caption"
              class="run-shot"
              loading="lazy"
              width="1269"
              height="945"
            />
            <p class="run-caption">{{ t.run.ui.caption }}</p>
            <a href="/docs/web-ui" class="run-link">{{ t.run.ui.link }} <Icon name="arrow" :size="14" /></a>
          </article>
        </div>
      </div>
    </section>

    <!-- 6 · built for agents -->
    <section class="ps-section agents">
      <div class="ps-container">
        <div class="ps-section-head">
          <h2 class="ps-h2">{{ t.agents.title }}</h2>
          <p class="ps-lead">{{ t.agents.lead }}</p>
        </div>
        <div class="agents-grid">
          <ul class="agents-list">
            <li v-for="item in t.agents.items" :key="item.title">
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </li>
          </ul>
          <aside class="agents-sample">
            <div class="agents-sample-label">{{ t.agents.sampleTitle }}</div>
            <pre><code>{{ SAMPLE }}</code></pre>
          </aside>
        </div>
      </div>
    </section>

    <!-- 7 · tool catalog -->
    <section class="ps-section">
      <div class="ps-container">
        <div class="ps-section-head">
          <h2 class="ps-h2">{{ fmt(t.toolsTeaser.title, { n: meta.toolsTotal }) }}</h2>
          <p class="ps-lead">
            {{ fmt(t.toolsTeaser.lead, { atomic: meta.toolsAtomic, recipes: meta.toolsRecipes }) }}
          </p>
        </div>
        <ToolExplorer teaser />
      </div>
    </section>

    <!-- 8 · faq -->
    <section class="ps-section">
      <div class="ps-container faq-wrap">
        <h2 class="ps-h2">{{ t.faq.title }}</h2>
        <FaqList />
      </div>
    </section>

    <!-- 9 · final cta -->
    <section class="ps-section cta">
      <div class="ps-container cta-inner">
        <h2 class="ps-h2 cta-title">{{ t.cta.title }}</h2>
        <p class="ps-lead">{{ t.cta.lead }}</p>
        <div class="cta-actions">
          <a :href="link('/docs/getting-started')" class="ps-btn ps-btn-primary ps-ants" data-cta="footer:get-started">
            {{ t.cta.button }}
          </a>
          <a :href="GITHUB" target="_blank" rel="noopener" class="ps-btn ps-btn-secondary">GitHub</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lp {
  overflow-x: hidden;
}

/* hero */
.hero {
  position: relative;
  padding: 72px 0 80px;
  border-bottom: 1px solid var(--vp-c-divider);
}
/* transparency grid as a backdrop layer, fading out downward so it frames the hero */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(45deg, var(--ps-checker) 25%, transparent 25%, transparent 75%, var(--ps-checker) 75%),
    linear-gradient(45deg, var(--ps-checker) 25%, transparent 25%, transparent 75%, var(--ps-checker) 75%);
  background-size: 24px 24px;
  background-position:
    0 0,
    12px 12px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.15) 78%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.15) 78%, transparent 100%);
}
.hero-grid {
  position: relative;
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.86fr);
  gap: 56px;
  align-items: center;
}
@media (max-width: 940px) {
  .hero {
    padding: 48px 0 56px;
  }
  .hero-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 36px;
  }
}
.hero-copy {
  display: grid;
  gap: 22px;
  align-content: start;
}
.hero-title {
  margin: 0;
  font-size: var(--ps-text-display);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 0.98;
  max-width: 12ch;
  border: none;
  padding: 0;
}
.hero-lead {
  margin: 0;
  font-size: var(--ps-text-lg);
  line-height: 1.5;
  color: var(--vp-c-text-2);
  max-width: 52ch;
}
.hero-trust {
  margin: 0;
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-3);
  max-width: 56ch;
}

/* works with */
.works {
  padding: 44px 0;
}
.works-title {
  margin: 0 0 16px;
  font-size: var(--ps-text-sm);
  font-weight: 500;
  color: var(--vp-c-text-3);
  border: none;
  padding: 0;
}
.works-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  align-items: baseline;
}
.works-list li {
  font-size: var(--ps-text-lg);
  font-weight: 500;
  letter-spacing: -0.015em;
  color: var(--vp-c-text-1);
}
.works-more {
  font-size: var(--ps-text-sm) !important;
  font-weight: 400 !important;
  color: var(--vp-c-text-3) !important;
}

/* steps */
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid var(--vp-c-divider);
}
@media (max-width: 820px) {
  .steps {
    grid-template-columns: minmax(0, 1fr);
  }
}
.step {
  padding: 24px 28px 28px 0;
  border-right: 1px solid var(--vp-c-divider);
  display: grid;
  gap: 8px;
  align-content: start;
}
.step:not(:first-child) {
  padding-left: 28px;
}
.step:last-child {
  border-right: none;
}
@media (max-width: 820px) {
  .step {
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
    padding: 20px 0;
  }
  .step:not(:first-child) {
    padding-left: 0;
  }
  .step:last-child {
    border-bottom: none;
  }
}
.step-n {
  font-family: var(--vp-font-family-mono);
  font-size: var(--ps-text-xs);
  color: var(--vp-c-brand-1);
}
.step-title {
  margin: 0;
  font-size: var(--ps-text-lg);
  font-weight: 600;
  letter-spacing: -0.015em;
  border: none;
  padding: 0;
}
.step-text {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.55;
  max-width: 40ch;
}

/* recipes head */
.recipes-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}

/* run */
.run-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 860px) {
  .run-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.run-card > * {
  min-width: 0;
}
.run-card {
  min-width: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--ps-radius);
  background: var(--ps-panel);
  padding: 24px;
  display: grid;
  gap: 14px;
  align-content: start;
}
.run-title {
  margin: 0;
  font-size: var(--ps-text-xl);
  font-weight: 600;
  letter-spacing: -0.015em;
  border: none;
  padding: 0;
}
.run-text {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.55;
}
/* the card already ends with its own "Set it up" link */
.run-strip :deep(.strip-label),
.run-strip :deep(.strip-more) {
  display: none;
}
.run-shot {
  width: 100%;
  height: auto;
  border-radius: var(--ps-radius-sm);
  border: 1px solid var(--vp-c-divider);
  display: block;
}
.run-caption {
  margin: -6px 0 0;
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-3);
}
.run-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--ps-text-sm);
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  margin-top: auto;
}
.run-link:hover {
  text-decoration: underline;
}

/* agents */
.agents {
  background: var(--vp-c-bg-alt);
}
.agents-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}
@media (max-width: 900px) {
  .agents-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .agents-sample {
    position: static;
  }
}
.agents-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 26px 32px;
}
@media (max-width: 620px) {
  .agents-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
.agents-list h3 {
  margin: 0 0 6px;
  font-size: var(--ps-text-md);
  font-weight: 600;
  border: none;
  padding: 0;
}
.agents-list p {
  margin: 0;
  font-size: var(--ps-text-sm);
  color: var(--vp-c-text-2);
  line-height: 1.55;
}
.agents-sample {
  border: 1px solid var(--vp-c-border);
  border-radius: var(--ps-radius);
  background: var(--ps-ink);
  overflow: hidden;
  position: sticky;
  top: 88px;
}
.agents-sample-label {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  font-size: var(--ps-text-xs);
  color: #9aa7bd;
}
.agents-sample pre {
  margin: 0;
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  color: #dbe3f0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  line-height: 1.6;
}

/* faq */
.faq-wrap {
  max-width: 840px;
}

/* cta */
.cta {
  border-top: 1px solid var(--vp-c-divider);
}
.cta-inner {
  display: grid;
  gap: 16px;
  justify-items: start;
}
.cta-title {
  max-width: 18ch;
}
.cta-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
}
</style>
