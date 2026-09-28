<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, CircleDashed, Loader2, X } from 'lucide-vue-next';
import ToolCallDetailDialog from './ToolCallDetailDialog.vue';
import PreviewImage from './PreviewImage.vue';
import type { ToolResult } from '@/lib/api';
import type { ToolStepStatus } from '@/lib/tool-result-status';
import { getToolIcon } from '@/lib/tool-icons';
import { describeToolCall, formatDuration } from '@/lib/tool-summary';

export type TimelineItem = {
  id: string;
  name: string;
  status: ToolStepStatus;
  input?: unknown;
  result?: ToolResult;
  rationale?: string;
  durationMs?: number;
  clickable?: boolean;
};

const props = defineProps<{
  items: TimelineItem[];
  showIndex?: boolean;
}>();

const rows = computed(() =>
  props.items.map((item, idx) => {
    const summary = describeToolCall(item.name, item.input);
    return {
      ...item,
      index: idx + 1,
      summary,
      icon: getToolIcon(item.name),
      duration: formatDuration(item.durationMs),
      thumb: item.result?.images?.[0],
    };
  })
);

const selectedId = ref<string | null>(null);
const selectedItem = computed(() => props.items.find((item) => item.id === selectedId.value) ?? null);

function open(item: TimelineItem): void {
  if (item.clickable === false) return;
  selectedId.value = item.id;
}
</script>

<template>
  <ol v-if="rows.length > 0" class="divide-y divide-border/60">
    <li
      v-for="row in rows"
      :key="row.id"
      class="flex items-center gap-3 px-3 py-2"
      :class="row.status === 'running' ? 'bg-[var(--photoshop-blue)]/5' : ''"
    >
      <span
        class="flex size-5 shrink-0 items-center justify-center rounded-full"
        :class="{
          'bg-emerald-500/15 text-emerald-500': row.status === 'done' || row.status === 'success',
          'bg-destructive/15 text-destructive': row.status === 'error',
          'text-[var(--photoshop-blue)]': row.status === 'running',
          'text-muted-foreground': row.status === 'pending',
        }"
        :aria-label="row.status"
      >
        <Check v-if="row.status === 'done' || row.status === 'success'" class="size-3" :stroke-width="3" />
        <X v-else-if="row.status === 'error'" class="size-3" :stroke-width="3" />
        <Loader2 v-else-if="row.status === 'running'" class="size-3.5 animate-spin" />
        <CircleDashed v-else class="size-3.5" />
      </span>

      <button
        type="button"
        class="flex min-w-0 flex-1 flex-col gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--photoshop-blue)] disabled:cursor-default"
        :disabled="row.clickable === false"
        :title="row.rationale || undefined"
        @click="open(row)"
      >
        <span class="flex min-w-0 items-center gap-1.5 text-[13px] leading-tight text-foreground">
          <span v-if="showIndex" class="shrink-0 font-mono text-[11px] text-muted-foreground">{{ row.index }}</span>
          <component :is="row.icon" class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="truncate font-medium">{{ row.summary.title }}</span>
        </span>
        <span v-if="row.summary.params.length || row.summary.swatch" class="flex flex-wrap items-center gap-1">
          <span
            v-if="row.summary.swatch"
            class="size-3.5 rounded-[4px] ring-1 ring-inset ring-white/20"
            :style="{ background: row.summary.swatch }"
          />
          <span
            v-for="param in row.summary.params"
            :key="param"
            class="rounded bg-muted/60 px-1.5 py-px font-mono text-[11px] text-muted-foreground"
          >{{ param }}</span>
        </span>
        <span
          v-if="row.status === 'error' && row.result?.content"
          class="line-clamp-2 text-[11px] text-destructive"
        >{{ row.result.content }}</span>
      </button>

      <span v-if="row.duration" class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {{ row.duration }}
      </span>
      <PreviewImage v-if="row.thumb" :image="row.thumb" :alt="`Preview after ${row.summary.title}`" size="thumb" />
    </li>
  </ol>

  <ToolCallDetailDialog
    :open="selectedItem !== null"
    :name="selectedItem?.name ?? ''"
    :status="selectedItem?.status ?? 'pending'"
    :input="selectedItem?.input"
    :result="selectedItem?.result"
    :rationale="selectedItem?.rationale"
    :duration-ms="selectedItem?.durationMs"
    @close="selectedId = null"
  />
</template>
