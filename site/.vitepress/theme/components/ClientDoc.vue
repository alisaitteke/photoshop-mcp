<script setup lang="ts">
import { computed } from 'vue';
import { CLIENTS, clientById } from '../../../data/clients';
import type { Os } from '../../../data/clients';
import { useClientChoice } from '../composables/useClientChoice';
import { useSiteI18n } from '../composables/useSiteI18n';
import ClientInstallCard from './ClientInstallCard.vue';

const props = defineProps<{ id: string }>();
const { t } = useSiteI18n();
const { os } = useClientChoice(CLIENTS.map((c) => c.id));
const client = computed(() => clientById(props.id));
// Photoshop itself only runs on macOS and Windows.
const OS_LIST: Os[] = ['mac', 'windows'];
</script>

<template>
  <div v-if="client" class="cd ps-embed">
    <div class="cd-os" role="radiogroup" aria-label="Operating system">
      <button
        v-for="o in OS_LIST"
        :key="o"
        type="button"
        role="radio"
        class="cd-os-btn"
        :class="{ active: os === o }"
        :aria-checked="os === o"
        @click="os = o"
      >
        {{ t.install.os[o] }}
      </button>
    </div>
    <ClientInstallCard :client="client" :os="os" />
  </div>
</template>

<style scoped>
.cd {
  display: grid;
  gap: 12px;
  margin: 20px 0 28px;
}
.cd-os {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  justify-self: start;
}
.cd-os-btn {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: var(--ps-text-xs);
  font-weight: 500;
  cursor: pointer;
}
.cd-os-btn.active {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
.cd-os-btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
