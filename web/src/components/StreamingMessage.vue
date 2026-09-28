<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import IntentChip from './IntentChip.vue';
import PlanCard from './PlanCard.vue';
import PreviewImage from './PreviewImage.vue';
import StepTimeline, { type TimelineItem } from './StepTimeline.vue';
import { effectiveToolStatus } from '@/lib/tool-result-status';
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
    Boolean(props.message.route) ||
    props.message.toolCalls.length > 0 ||
    Boolean(activityLabel.value)
);

const standaloneItems = computed((): TimelineItem[] =>
  props.standaloneToolCalls.map((tc) => ({
    id: tc.id,
    name: tc.name,
    status: effectiveToolStatus(tc),
    input: tc.input,
    result: tc.result,
    durationMs: tc.durationMs,
    clickable: true,
  }))
);

/** The newest image any tool returned in this turn: what the document looks like now. */
const latestPreview = computed(() => {
  const calls = props.message.toolCalls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const images = calls[i]!.result?.images;
    if (images?.length) {
      return { image: images[images.length - 1]!, step: i + 1 };
    }
  }
  return null;
});
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

    <div v-if="message.route" class="flex">
      <IntentChip :route="message.route" />
    </div>

    <PlanCard
      v-if="message.plan"
      :plan="message.plan"
      :tool-calls="message.toolCalls"
      :partial="message.planPartial"
    />

    <div
      v-if="standaloneItems.length > 0"
      class="overflow-hidden rounded-lg border border-border bg-card/50"
    >
      <StepTimeline :items="standaloneItems" />
    </div>

    <figure v-if="latestPreview" class="m-0 flex flex-col gap-1.5">
      <PreviewImage
        :image="latestPreview.image"
        :alt="`Document preview after step ${latestPreview.step}`"
      />
      <figcaption class="text-[11px] text-muted-foreground">
        Photoshop document after step {{ latestPreview.step }} · click to enlarge
      </figcaption>
    </figure>

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
