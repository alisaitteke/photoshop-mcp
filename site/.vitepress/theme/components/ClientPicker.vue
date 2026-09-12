<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CLIENTS, TIER1, TIER2, clientById } from '../../../data/clients';
import type { Os } from '../../../data/clients';
import { useClientChoice } from '../composables/useClientChoice';
import { useSiteI18n } from '../composables/useSiteI18n';
import ClientInstallCard from './ClientInstallCard.vue';

const { t } = useSiteI18n();
const { selected, os } = useClientChoice(CLIENTS.map((c) => c.id));
const other = clientById('other')!;
const current = computed(() => clientById(selected.value) ?? TIER1[0]);
const showMore = ref(false);
// Keep the list open when the stored choice is one of the less common clients.
watch(
  selected,
  (id) => {
    if (TIER2.some((c) => c.id === id)) showMore.value = true;
  },
  { immediate: true },
);
// Photoshop itself only runs on macOS and Windows.
const OS_LIST: Os[] = ['mac', 'windows'];
</script>

<template>
  <div class="picker ps-embed">
    <div class="picker-bar">
      <div class="tabs" role="tablist">
        <span class="tabs-group">{{ t.install.tier1 }}</span>
        <button
          v-for="c in TIER1"
          :key="c.id"
          type="button"
          role="tab"
          class="tab"
          :class="{ active: selected === c.id }"
          :aria-selected="selected === c.id"
          @click="selected = c.id"
        >
          {{ c.name }}
        </button>
        <button
          type="button"
          class="tab tab-more"
          :aria-expanded="showMore"
          @click="showMore = !showMore"
        >
          {{ t.install.tier2 }}
          <span class="tab-more-mark" aria-hidden="true">{{ showMore ? '–' : '+' }}</span>
        </button>
        <button
          v-for="c in (showMore ? TIER2 : [])"
          :key="c.id"
          type="button"
          role="tab"
          class="tab"
          :class="{ active: selected === c.id }"
          :aria-selected="selected === c.id"
          @click="selected = c.id"
        >
          {{ c.name }}
        </button>
        <button
          v-if="showMore"
          type="button"
          role="tab"
          class="tab"
          :class="{ active: selected === other.id }"
          :aria-selected="selected === other.id"
          @click="selected = other.id"
        >
          {{ t.install.other }}
        </button>
      </div>
      <div class="os" role="radiogroup" aria-label="Operating system">
        <button
          v-for="o in OS_LIST"
          :key="o"
          type="button"
          role="radio"
          class="os-btn"
          :class="{ active: os === o }"
          :aria-checked="os === o"
          @click="os = o"
        >
          {{ t.install.os[o] }}
        </button>
      </div>
    </div>
    <ClientInstallCard :client="current" :os="os" />
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  gap: 16px;
  margin: 8px 0 24px;
}
.picker-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
  justify-content: space-between;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.tabs-group {
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-3);
  margin: 0 4px 0 2px;
}
.tab-more {
  border-style: dashed;
  color: var(--vp-c-text-2);
}
.tab-more-mark {
  margin-left: 6px;
  opacity: 0.7;
}
.tab,
.os-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-border);
  background: var(--ps-panel);
  color: var(--vp-c-text-1);
  font-size: var(--ps-text-xs);
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}
.tab:hover,
.os-btn:hover {
  border-color: var(--vp-c-brand-1);
}
.tab.active,
.os-btn.active {
  background: var(--vp-c-text-1);
  border-color: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
.tab:focus-visible,
.os-btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.os {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
}
.os-btn {
  height: 28px;
  border: none;
  background: transparent;
}
</style>
