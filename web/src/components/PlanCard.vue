<script setup lang="ts">
import { computed } from 'vue';
import { ListChecks } from 'lucide-vue-next';
import ToolCallStrip, { type ToolStripItem } from './ToolCallStrip.vue';
import type { PlanView } from '@/lib/api';
import type { ToolCall } from '@/stores/chat';

const props = defineProps<{
  plan: PlanView;
  toolCalls?: ToolCall[];
  partial?: boolean;
}>();

const done = computed(() => props.plan.steps.filter((s) => s.status === 'done').length);

const stripItems = computed((): ToolStripItem[] =>
  props.plan.steps.map((step, idx) => {
    const toolCall = props.toolCalls?.[idx];
    const name = step.tool || toolCall?.name || '…';

    return {
      id: step.id,
      name,
      status: step.status,
      input: toolCall?.input,
      result: toolCall?.result,
      rationale: step.rationale,
      clickable: Boolean(step.tool || toolCall),
    };
  })
);
</script>

<template>
  <div class="rounded-lg border border-border bg-card/50">
    <div class="space-y-1 border-b border-border px-3 py-2">
      <div class="flex items-center gap-2 text-xs">
        <ListChecks class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="font-medium text-foreground">Action plan</span>
        <span
          v-if="partial"
          class="rounded bg-amber-500/15 px-1 text-[9px] font-semibold uppercase text-amber-600"
        >
          Draft
        </span>
        <span class="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {{ done }}/{{ plan.steps.length || '…' }}
        </span>
      </div>
      <p class="text-[11px] leading-snug text-muted-foreground">
        {{ plan.summary || '…' }}
      </p>
    </div>
    <ToolCallStrip :items="stripItems" show-index />
  </div>
</template>
