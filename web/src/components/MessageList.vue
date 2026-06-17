<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { User, Sparkles } from 'lucide-vue-next';
import ToolCallCard from './ToolCallCard.vue';
import PlanCard from './PlanCard.vue';
import ProviderIcon from './ProviderIcon.vue';
import type { ChatMessage } from '@/stores/chat';
import type { ProviderInfo } from '@/lib/api';

const props = defineProps<{
  messages: ChatMessage[];
  busy: boolean;
  providers: ProviderInfo[];
}>();

const scroller = ref<HTMLElement | null>(null);

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (scroller.value) {
    scroller.value.scrollTop = scroller.value.scrollHeight;
  }
}

watch(
  () => [props.messages.length, props.busy, props.messages[props.messages.length - 1]?.text],
  () => {
    void scrollToBottom();
  },
  { deep: true }
);

onMounted(scrollToBottom);

function assistantLabel(m: ChatMessage): string {
  if (!m.provider) return 'Assistant';
  const provider = props.providers.find((p) => p.id === m.provider);
  const providerLabel = provider?.label ?? m.provider;
  const modelLabel = provider?.models.find((mm) => mm.id === m.model)?.label ?? m.model;
  return modelLabel ? `${providerLabel} · ${modelLabel}` : providerLabel;
}

/** When an action plan is present, tool calls are shown inline on the plan rows. */
function standaloneToolCalls(m: ChatMessage) {
  if (!m.plan) return m.toolCalls;
  return m.toolCalls.slice(m.plan.steps.length);
}
</script>

<template>
  <div ref="scroller" class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div
        v-if="messages.length === 0"
        class="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center"
      >
        <Sparkles class="mx-auto mb-3 size-6 text-muted-foreground" />
        <h2 class="text-base font-semibold">Tell the assistant what to do in Photoshop</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Try: "Create a new 1920×1080 document, fill the background with light blue,
          add the text 'Hello' in the center, and save it as hello.psd on my Desktop."
        </p>
      </div>

      <div v-for="m in messages" :key="m.id" class="flex gap-3">
        <div
          class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
        >
          <User v-if="m.role === 'user'" class="size-4" />
          <ProviderIcon v-else-if="m.provider" :provider="m.provider" :size="16" />
          <Sparkles v-else class="size-4" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="text-xs font-medium text-muted-foreground">
            {{ m.role === 'user' ? 'You' : assistantLabel(m) }}
          </div>
          <div
            v-if="m.text"
            class="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
          >{{ m.text }}</div>
          <PlanCard v-if="m.plan" :plan="m.plan" :tool-calls="m.toolCalls" />
          <ToolCallCard v-for="tc in standaloneToolCalls(m)" :key="tc.id" :tool-call="tc" />
        </div>
      </div>

      <div v-if="busy" class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Working…
      </div>
    </div>
  </div>
</template>
