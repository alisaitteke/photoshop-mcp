<script setup lang="ts">
import { computed, ref } from 'vue';
import ToolCallDetailDialog from './ToolCallDetailDialog.vue';
import ToolCallOrb, { type ToolOrbStatus } from './ToolCallOrb.vue';

export type ToolStripItem = {
  id: string;
  name: string;
  status: ToolOrbStatus;
  input?: unknown;
  result?: { ok: boolean; content: string };
  rationale?: string;
  clickable?: boolean;
};

const props = defineProps<{
  items: ToolStripItem[];
  showIndex?: boolean;
}>();

const selectedId = ref<string | null>(null);

const selectedItem = computed(() =>
  props.items.find((item) => item.id === selectedId.value) ?? null
);

function openItem(item: ToolStripItem): void {
  if (item.clickable === false) return;
  selectedId.value = item.id;
}

function closeDialog(): void {
  selectedId.value = null;
}
</script>

<template>
  <div v-if="items.length > 0" class="max-w-full overflow-x-auto px-3 py-2">
    <div class="flex flex-wrap gap-3">
      <ToolCallOrb
        v-for="(item, idx) in items"
        :key="item.id"
        :name="item.name"
        :status="item.status"
        :index="showIndex ? idx : undefined"
        :disabled="item.clickable === false"
        @click="openItem(item)"
      />
    </div>
  </div>

  <ToolCallDetailDialog
    :open="selectedItem !== null"
    :name="selectedItem?.name ?? ''"
    :status="selectedItem?.status ?? 'pending'"
    :input="selectedItem?.input"
    :result="selectedItem?.result"
    :rationale="selectedItem?.rationale"
    @close="closeDialog"
  />
</template>
