<script setup lang="ts">
import { computed, ref } from 'vue';
import { RECIPES, RECIPE_GROUPS } from '../../../data/recipes';
import type { RecipeGroup } from '../../../data/recipes';
import { useSiteI18n } from '../composables/useSiteI18n';
import CopyButton from './CopyButton.vue';
import Icon from './Icon.vue';

const props = defineProps<{ limit?: number; full?: boolean }>();
const { t, link } = useSiteI18n();
const group = ref<RecipeGroup | 'all'>('all');
const list = computed(() => {
  const l = group.value === 'all' ? RECIPES : RECIPES.filter((r) => r.group === group.value);
  return props.limit ? l.slice(0, props.limit) : l;
});
const groupLabel = (id: RecipeGroup) => RECIPE_GROUPS.find((g) => g.id === id)?.label ?? id;
</script>

<template>
  <div class="rg ps-embed">
    <div class="rg-filters" role="tablist">
      <button
        type="button"
        class="rg-filter"
        :class="{ active: group === 'all' }"
        role="tab"
        :aria-selected="group === 'all'"
        @click="group = 'all'"
      >
        {{ t.recipes.all }}
        <span class="rg-count">{{ RECIPES.length }}</span>
      </button>
      <button
        v-for="g in RECIPE_GROUPS"
        :key="g.id"
        type="button"
        class="rg-filter"
        :class="{ active: group === g.id }"
        role="tab"
        :aria-selected="group === g.id"
        @click="group = g.id"
      >
        {{ g.label }}
        <span class="rg-count">{{ RECIPES.filter((r) => r.group === g.id).length }}</span>
      </button>
    </div>

    <ul class="rg-grid" :class="{ full }">
      <li v-for="r in list" :key="r.id" class="rc" :id="full ? r.id : undefined">
        <img :src="r.image" :alt="r.title" class="rc-img" loading="lazy" width="640" height="260" />
        <div class="rc-body">
          <div class="rc-top">
            <h3 class="rc-title">{{ r.title }}</h3>
            <span class="rc-group">{{ groupLabel(r.group) }}</span>
          </div>
          <p class="rc-summary">{{ r.summary }}</p>
          <template v-if="full">
            <blockquote class="rc-prompt">{{ r.prompt }}</blockquote>
            <dl class="rc-meta">
              <div>
                <dt>{{ t.recipes.tool }}</dt>
                <dd><code>{{ r.tool }}</code></dd>
              </div>
              <div>
                <dt>{{ t.recipes.template }}</dt>
                <dd><code>{{ r.template }}</code></dd>
              </div>
              <div v-if="r.params">
                <dt>{{ t.recipes.params }}</dt>
                <dd><code>{{ r.params }}</code></dd>
              </div>
            </dl>
          </template>
          <div class="rc-actions">
            <CopyButton :text="r.prompt" :label="t.recipes.copyPrompt" :copied-label="t.recipes.promptCopied" small :cta="`recipe:${r.id}`" />
            <a v-if="!full" :href="`${link('/recipes')}#${r.id}`" class="rc-more">
              <Icon name="arrow" :size="14" />
            </a>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.rg {
  display: grid;
  gap: 24px;
}
.rg-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rg-filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-border);
  background: var(--ps-panel);
  color: var(--vp-c-text-1);
  font-size: var(--ps-text-xs);
  font-weight: 500;
  cursor: pointer;
}
.rg-filter:hover {
  border-color: var(--vp-c-brand-1);
}
.rg-filter.active {
  background: var(--vp-c-text-1);
  border-color: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
.rg-filter:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.rg-count {
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  opacity: 0.7;
}
.rg-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr));
  gap: 16px;
}
.rg-grid.full {
  grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr));
  gap: 20px;
}
.rc {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--ps-radius);
  background: var(--ps-panel);
  overflow: hidden;
  margin: 0;
  scroll-margin-top: 90px;
}
.rc-img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 640 / 260;
  object-fit: cover;
  border-bottom: 1px solid var(--vp-c-divider);
  background: #f6f8fa;
}
.rc-body > * {
  min-width: 0;
}
.rc-body {
  padding: 16px;
  display: grid;
  gap: 10px;
  align-content: start;
  flex: 1;
}
.rc-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.rc-title {
  margin: 0;
  font-size: var(--ps-text-md);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
  border: none;
  padding: 0;
}
.rc-group {
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
.rc-summary {
  margin: 0;
  font-size: var(--ps-text-sm);
  color: var(--vp-c-text-2);
  line-height: 1.5;
}
.rc-prompt {
  margin: 4px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 0 var(--ps-radius-sm) var(--ps-radius-sm) 0;
  font-size: var(--ps-text-sm);
  line-height: 1.5;
  color: var(--vp-c-text-1);
}
.rc-meta {
  margin: 0;
  display: grid;
  gap: 6px;
  font-size: var(--ps-text-xs);
}
.rc-meta div {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
  align-items: baseline;
}
.rc-meta dt {
  color: var(--vp-c-text-3);
}
.rc-meta dd {
  margin: 0;
  min-width: 0;
}
.rc-meta code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  word-break: break-all;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-alt);
  padding: 1px 6px;
  border-radius: 5px;
}
.rc-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
}
.rc-more {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-divider);
}
.rc-more:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
</style>
