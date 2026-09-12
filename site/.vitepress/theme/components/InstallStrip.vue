<script setup lang="ts">
import { ref } from 'vue';
import { CLIENTS, TIER1, deriveConfig } from '../../../data/clients';
import type { ClientDef } from '../../../data/clients';
import { useClientChoice } from '../composables/useClientChoice';
import { useSiteI18n } from '../composables/useSiteI18n';
import Icon from './Icon.vue';

const { t, fmt, link } = useSiteI18n();
const { selected } = useClientChoice(CLIENTS.map((c) => c.id));
const cfg = deriveConfig();
const copiedId = ref<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

function href(c: ClientDef): string | undefined {
  return c.deeplink?.(cfg);
}

async function onCli(c: ClientDef): Promise<void> {
  selected.value = c.id;
  if (!c.cli) return;
  try {
    await navigator.clipboard.writeText(c.cli);
    copiedId.value = c.id;
    clearTimeout(timer);
    timer = setTimeout(() => (copiedId.value = null), 2000);
  } catch {
    window.location.href = link('/docs/getting-started');
  }
}

function icon(c: ClientDef): 'link' | 'download' | 'terminal' {
  if (c.mechanism === 'deeplink') return 'link';
  if (c.mechanism === 'download') return 'download';
  return 'terminal';
}
</script>

<template>
  <div class="strip">
    <span class="strip-label">{{ t.hero.installIn }}</span>
    <div class="strip-row">
      <template v-for="c in TIER1" :key="c.id">
        <a
          v-if="href(c)"
          :href="href(c)"
          class="ps-btn ps-btn-secondary ps-ants"
          :data-cta="`hero:${c.id}`"
          @click="selected = c.id"
        >
          <Icon :name="icon(c)" :size="16" />
          {{ c.name }}
        </a>
        <button
          v-else
          type="button"
          class="ps-btn ps-btn-secondary ps-ants"
          :class="{ copied: copiedId === c.id }"
          :data-cta="`hero:${c.id}`"
          @click="onCli(c)"
        >
          <Icon :name="copiedId === c.id ? 'check' : icon(c)" :size="16" />
          {{ copiedId === c.id ? t.install.copied : c.name }}
        </button>
      </template>
    </div>
    <a :href="link('/docs/getting-started')" class="strip-more" data-cta="hero:setup-guide">
      {{ t.hero.setupGuide }}
      <Icon name="arrow" :size="15" />
    </a>
  </div>
</template>

<style scoped>
.strip {
  display: grid;
  gap: 10px;
}
.strip-label {
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-3);
}
.strip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.strip-row .ps-btn {
  height: 42px;
}
.ps-btn.copied {
  border-color: var(--ps-ok);
  color: var(--ps-ok) !important;
}
.strip-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  font-size: var(--ps-text-sm);
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.strip-more:hover {
  text-decoration: underline;
}
@media (max-width: 640px) {
  .strip-row {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 6px;
    margin: 0 -24px;
    padding-left: 24px;
    padding-right: 24px;
    scrollbar-width: none;
  }
  .strip-more {
    white-space: nowrap;
  }
}
</style>
