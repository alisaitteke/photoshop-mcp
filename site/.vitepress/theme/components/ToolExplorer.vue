<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import tools from '../../../data/tools.json';
import { useSiteI18n } from '../composables/useSiteI18n';
import Icon from './Icon.vue';
import CopyButton from './CopyButton.vue';

type Tool = (typeof tools.tools)[number];

const props = defineProps<{ teaser?: boolean }>();
const { t, fmt, link } = useSiteI18n();

const q = ref('');
const category = ref<string>('all');
const kind = ref<'all' | 'atomic' | 'recipe'>('all');
const open = ref<Set<string>>(new Set());

onMounted(() => {
  if (props.teaser) return;
  const u = new URL(window.location.href);
  q.value = u.searchParams.get('q') ?? '';
  const c = u.searchParams.get('category');
  if (c && tools.categories.some((x) => x.id === c)) category.value = c;
});

const norm = (s: string) => s.toLowerCase();
const filtered = computed<Tool[]>(() => {
  const needle = norm(q.value.trim());
  return tools.tools.filter((tool) => {
    if (category.value !== 'all' && tool.categoryId !== category.value) return false;
    if (kind.value !== 'all' && tool.kind !== kind.value) return false;
    if (!needle) return true;
    return (
      norm(tool.name).includes(needle) ||
      norm(tool.description).includes(needle) ||
      tool.params.some((p) => norm(p.name).includes(needle))
    );
  });
});

const teaserMatches = computed(() => (q.value.trim() ? filtered.value.slice(0, 5) : []));

function submitTeaser(): void {
  const u = new URL(link('/tools'), window.location.origin);
  if (q.value.trim()) u.searchParams.set('q', q.value.trim());
  window.location.href = u.pathname + u.search;
}

function toggle(name: string): void {
  const s = new Set(open.value);
  if (s.has(name)) s.delete(name);
  else s.add(name);
  open.value = s;
}
</script>

<template>
  <!-- teaser: search box that jumps to /tools -->
  <div v-if="teaser" class="te">
    <form class="te-form" role="search" @submit.prevent="submitTeaser">
      <Icon name="search" :size="18" />
      <input v-model="q" type="search" class="te-input" :placeholder="t.toolsTeaser.placeholder" aria-label="Search tools" />
      <button type="submit" class="ps-btn ps-btn-primary ps-btn-sm">{{ t.toolsTeaser.browse }}</button>
    </form>
    <ul v-if="teaserMatches.length" class="te-matches">
      <li v-for="tool in teaserMatches" :key="tool.name">
        <a :href="`${link('/tools')}?q=${encodeURIComponent(q)}#${tool.name}`">
          <code>{{ tool.name }}</code>
          <span>{{ tool.description }}</span>
        </a>
      </li>
    </ul>
    <p v-else-if="q.trim()" class="te-none">{{ fmt(t.toolsTeaser.noResults, { q }) }}</p>
    <ul v-else class="te-cats">
      <li v-for="c in tools.categories" :key="c.id">
        <a :href="`${link('/tools')}?category=${c.id}`">{{ c.label }} <span>{{ c.count }}</span></a>
      </li>
    </ul>
  </div>

  <!-- full explorer -->
  <div v-else class="tx ps-embed">
    <div class="tx-bar">
      <label class="tx-search">
        <Icon name="search" :size="18" />
        <input v-model="q" type="search" class="tx-input" :placeholder="t.toolsTeaser.placeholder" aria-label="Search tools" />
      </label>
      <div class="tx-kinds" role="radiogroup">
        <button
          v-for="k in (['all', 'atomic', 'recipe'] as const)"
          :key="k"
          type="button"
          role="radio"
          class="tx-chip"
          :class="{ active: kind === k }"
          :aria-checked="kind === k"
          @click="kind = k"
        >
          {{ k === 'all' ? t.recipes.all : t.toolsTeaser.kinds[k] }}
        </button>
      </div>
    </div>
    <div class="tx-cats">
      <button type="button" class="tx-chip" :class="{ active: category === 'all' }" @click="category = 'all'">
        {{ t.toolsTeaser.allCategories }} <span>{{ tools.total }}</span>
      </button>
      <button
        v-for="c in tools.categories"
        :key="c.id"
        type="button"
        class="tx-chip"
        :class="{ active: category === c.id }"
        @click="category = c.id"
      >
        {{ c.label }} <span>{{ c.count }}</span>
      </button>
    </div>

    <p class="tx-count">{{ fmt(t.toolsTeaser.results, { n: filtered.length }) }}</p>

    <ul class="tx-list">
      <li v-for="tool in filtered" :key="tool.name" :id="tool.name" class="tr" :class="{ open: open.has(tool.name) }">
        <button type="button" class="tr-head" :aria-expanded="open.has(tool.name)" @click="toggle(tool.name)">
          <span class="tr-kind" :class="tool.kind">{{ t.toolsTeaser.kinds[tool.kind] }}</span>
          <code class="tr-name">{{ tool.name }}</code>
          <span class="tr-cat">{{ tool.category }}</span>
          <span class="tr-params">
            {{ tool.params.length }}
            {{ tool.params.length === 1 ? t.toolsTeaser.paramsOne : t.toolsTeaser.params }}
          </span>
          <Icon name="chevron" :size="16" class="tr-chev" />
        </button>
        <div v-if="open.has(tool.name)" class="tr-body">
          <p class="tr-desc">{{ tool.description }}</p>
          <table v-if="tool.params.length" class="tr-table">
            <thead>
              <tr>
                <th>name</th>
                <th>type</th>
                <th>description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in tool.params" :key="p.name">
                <td>
                  <code>{{ p.name }}</code>
                  <span v-if="p.required" class="tr-req" title="required">*</span>
                </td>
                <td>
                  <code>{{ p.type }}</code>
                  <template v-if="p.enum"><br /><small>{{ p.enum.join(' | ') }}</small></template>
                </td>
                <td>{{ p.description }}</td>
              </tr>
            </tbody>
          </table>
          <div class="tr-foot">
            <CopyButton :text="tool.name" small />
            <a :href="`https://github.com/alisaitteke/photoshop-mcp/blob/master/${tool.source}`" target="_blank" rel="noopener" class="tr-src">
              {{ tool.source }} <Icon name="external" :size="13" />
            </a>
          </div>
        </div>
      </li>
    </ul>
    <p v-if="!filtered.length" class="te-none">{{ fmt(t.toolsTeaser.noResults, { q }) }}</p>
  </div>
</template>

<style scoped>
/* teaser */
.te {
  display: grid;
  gap: 14px;
}
.te-form {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px 6px 14px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--ps-radius);
  background: var(--ps-panel);
  color: var(--vp-c-text-3);
}
.te-form:focus-within {
  border-color: var(--vp-c-brand-1);
}
.te-input,
.tx-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: var(--ps-text-md);
  color: var(--vp-c-text-1);
}
.te-matches,
.te-cats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.te-matches {
  flex-direction: column;
}
.te-matches a {
  display: flex;
  gap: 12px;
  align-items: baseline;
  text-decoration: none;
  color: var(--vp-c-text-2);
  font-size: var(--ps-text-sm);
  padding: 6px 10px;
  border-radius: var(--ps-radius-sm);
}
.te-matches a:hover {
  background: var(--vp-c-bg-alt);
}
.te-matches code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
  white-space: nowrap;
}
.te-matches span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.te-cats a {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-2);
  text-decoration: none;
}
.te-cats a:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}
.te-cats span {
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  opacity: 0.7;
}
.te-none {
  margin: 0;
  color: var(--vp-c-text-3);
  font-size: var(--ps-text-sm);
}

/* full */
.tx {
  display: grid;
  gap: 14px;
  margin-top: 8px;
}
.tx-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
.tx-search {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 44px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--ps-radius-sm);
  background: var(--ps-panel);
  color: var(--vp-c-text-3);
}
.tx-search:focus-within {
  border-color: var(--vp-c-brand-1);
}
.tx-kinds,
.tx-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tx-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-border);
  background: var(--ps-panel);
  color: var(--vp-c-text-1);
  font-size: var(--ps-text-xs);
  font-weight: 500;
  cursor: pointer;
}
.tx-chip span {
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  opacity: 0.7;
}
.tx-chip:hover {
  border-color: var(--vp-c-brand-1);
}
.tx-chip.active {
  background: var(--vp-c-text-1);
  border-color: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
.tx-count {
  margin: 0;
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-3);
}
.tx-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--ps-radius);
  overflow: hidden;
  background: var(--ps-panel);
}
.tr + .tr {
  border-top: 1px solid var(--vp-c-divider);
}
.tr {
  scroll-margin-top: 90px;
}
.tr-head {
  width: 100%;
  display: grid;
  grid-template-columns: 62px 1fr auto auto 20px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: var(--vp-c-text-1);
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.tr-head:hover {
  background: var(--vp-c-bg-alt);
}
.tr-head:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}
.tr-kind {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 5px;
  text-align: center;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-2);
}
.tr-kind.recipe {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.tr-name {
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tr-cat,
.tr-params {
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
.tr-chev {
  color: var(--vp-c-text-3);
  transition: transform 0.15s ease;
}
.tr.open .tr-chev {
  transform: rotate(180deg);
}
.tr-body {
  padding: 4px 14px 16px 88px;
  display: grid;
  gap: 12px;
}
.tr-desc {
  margin: 0;
  font-size: var(--ps-text-sm);
  color: var(--vp-c-text-2);
  line-height: 1.55;
}
.tr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ps-text-xs);
  margin: 0;
}
.tr-table th,
.tr-table td {
  text-align: left;
  vertical-align: top;
  padding: 6px 8px;
  border-top: 1px solid var(--vp-c-divider);
}
.tr-table th {
  color: var(--vp-c-text-3);
  font-weight: 500;
  border-top: none;
}
.tr-table code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
}
.tr-req {
  color: var(--vp-c-brand-1);
  margin-left: 2px;
}
.tr-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.tr-src {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  text-decoration: none;
}
.tr-src:hover {
  color: var(--vp-c-brand-1);
}
@media (max-width: 720px) {
  .tr-head {
    grid-template-columns: 56px 1fr 20px;
  }
  .tr-cat,
  .tr-params {
    display: none;
  }
  .tr-body {
    padding-left: 14px;
  }
}
</style>
