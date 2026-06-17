<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import PlanCard from './PlanCard.vue';
import ToolCallStrip, { type ToolStripItem } from './ToolCallStrip.vue';
import type { ChatMessage, ToolCall } from '@/stores/chat';

const props = defineProps<{
  message: ChatMessage;
  standaloneToolCalls: ToolCall[];
}>();

const reasoningOpen = ref(false);

const showReasoning = computed(
  () => Boolean(props.message.reasoning?.length) || props.message.isStreaming
);

const activityLabel = computed((): string | null => {
  const activity = props.message.activity;
  if (!activity) return null;
  if (activity.phase === 'planning') return 'Planning…';
  if (activity.phase === 'thinking') return 'Thinking…';
  if (activity.phase === 'tool-running') {
    const detail = activity.detail?.replace(/^mcp__photoshop__/, '') ?? 'tool';
    return `Running ${detail}…`;
  }
  return null;
});

const showActivity = computed(
  () =>
    Boolean(activityLabel.value) &&
    !props.message.text &&
    !props.message.reasoning &&
    !props.message.plan
);

const showContent = computed(
  () =>
    props.message.isStreaming ||
    Boolean(props.message.text) ||
    Boolean(props.message.reasoning) ||
    Boolean(props.message.plan) ||
    props.message.toolCalls.length > 0 ||
    Boolean(activityLabel.value)
);

const standaloneStripItems = computed((): ToolStripItem[] =>
  props.standaloneToolCalls.map((tc) => ({
    id: tc.id,
    name: tc.name,
    status: tc.status === 'success' ? 'done' : tc.status,
    input: tc.input,
    result: tc.result,
    clickable: true,
  }))
);
</script>

<template>
  <div v-if="showContent" class="flex flex-col gap-2">
    <div
      v-if="showActivity"
      class="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span class="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground" />
      {{ activityLabel }}
    </div>

    <div v-if="showReasoning" class="rounded-md border border-border/60 bg-muted/20">
      <button
        type="button"
        class="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
        @click="reasoningOpen = !reasoningOpen"
      >
        <component :is="reasoningOpen ? ChevronDown : ChevronRight" class="size-3.5 shrink-0" />
        <span class="font-medium">Reasoning</span>
        <span v-if="message.isStreaming && !message.text" class="animate-pulse">…</span>
      </button>
      <div
        v-if="reasoningOpen && message.reasoning"
        class="border-t border-border/60 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap"
      >
        {{ message.reasoning }}<span
          v-if="message.isStreaming"
          class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-muted-foreground align-middle"
        />
      </div>
    </div>

    <PlanCard
      v-if="message.plan"
      :plan="message.plan"
      :tool-calls="message.toolCalls"
      :partial="message.planPartial"
    />

    <div
      v-if="standaloneStripItems.length > 0"
      class="rounded-lg border border-border bg-card/50"
    >
      <ToolCallStrip :items="standaloneStripItems" />
    </div>

    <div
      v-if="message.text || (message.isStreaming && !showActivity)"
      class="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
    >
      {{ message.text }}<span
        v-if="message.isStreaming"
        class="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-middle"
      />
    </div>
  </div>
</template>
