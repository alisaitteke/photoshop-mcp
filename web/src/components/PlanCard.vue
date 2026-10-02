<script setup lang="ts">
import { computed } from 'vue';
import { ListChecks } from 'lucide-vue-next';
import StepTimeline, { type TimelineItem } from './StepTimeline.vue';
import { effectiveToolStatus } from '@/lib/tool-result-status';
import { formatDuration } from '@/lib/tool-summary';
import type { PlanView } from '@/lib/api';
import type { ToolCall } from '@/stores/chat';

const props = defineProps<{
  plan: PlanView;
  toolCalls?: ToolCall[];
  partial?: boolean;
}>();

const done = computed(() => props.plan.steps.filter((s) => s.status === 'done').length);

function callForStep(stepId: string, idx: number): ToolCall | undefined {
  const calls = props.toolCalls ?? [];
  if (stepId && calls.some((tc) => tc.stepId)) {
    for (let i = calls.length - 1; i >= 0; i--) {
      if (calls[i]?.stepId === stepId) return calls[i];
    }
    return undefined;
  }
  return calls[idx];
}

const items = computed((): TimelineItem[] =>
  props.plan.steps.map((step, idx) => {
    const toolCall = callForStep(step.id, idx);
    const name = step.tool || toolCall?.name || '…';

    return {
      id: step.id,
      name,
      status: toolCall ? effectiveToolStatus(toolCall, step.status) : step.status,
      input: toolCall?.input,
      result: toolCall?.result,
      rationale: step.rationale,
      durationMs: toolCall?.durationMs,
      clickable: Boolean(step.tool || toolCall),
    };
  })
);

const totalDuration = computed(() => {
  const ms = (props.toolCalls ?? []).reduce((sum, tc) => sum + (tc.durationMs ?? 0), 0);
  return ms > 0 ? formatDuration(ms) : null;
});
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border bg-card/50">
    <div class="space-y-1 border-b border-border px-3 py-2">
      <div class="flex items-center gap-2 text-xs">
        <ListChecks class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="font-medium text-foreground">Plan · {{ plan.steps.length || '…' }} steps</span>
        <span
          v-if="partial"
          class="rounded bg-amber-500/15 px-1 text-[9px] font-semibold uppercase text-amber-600"
        >
          Draft
        </span>
        <span class="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
          <template v-if="totalDuration">{{ totalDuration }} · </template>{{ done }}/{{ plan.steps.length || '…' }}
        </span>
      </div>
      <p class="text-[11px] leading-snug text-muted-foreground">
        {{ plan.summary || '…' }}
      </p>
    </div>
    <StepTimeline :items="items" show-index />
  </div>
</template>
