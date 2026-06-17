<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  ListChecks,
} from 'lucide-vue-next';
import type { PlanView } from '@/lib/api';
import type { ToolCall } from '@/stores/chat';

const props = defineProps<{
  plan: PlanView;
  toolCalls?: ToolCall[];
}>();

const expanded = ref<Set<string>>(new Set());

const done = computed(() => props.plan.steps.filter((s) => s.status === 'done').length);

function displayTool(name: string): string {
  return name.startsWith('mcp__photoshop__') ? name.slice('mcp__photoshop__'.length) : name;
}

function toolCallForStep(index: number): ToolCall | undefined {
  return props.toolCalls?.[index];
}

function toggleStep(stepId: string): void {
  const next = new Set(expanded.value);
  if (next.has(stepId)) next.delete(stepId);
  else next.add(stepId);
  expanded.value = next;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stepExpandable(index: number): boolean {
  return toolCallForStep(index) !== undefined;
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card/50">
    <div class="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
      <ListChecks class="size-3.5 text-muted-foreground" />
      <span class="font-medium text-foreground">Action plan</span>
      <span class="truncate text-muted-foreground">· {{ plan.summary }}</span>
      <span class="ml-auto shrink-0 text-[10px] text-muted-foreground">
        {{ done }}/{{ plan.steps.length }}
      </span>
    </div>
    <ol class="divide-y divide-border/60">
      <li v-for="(step, idx) in plan.steps" :key="step.id">
        <div class="flex items-start gap-2 px-3 py-2 text-xs">
          <span class="mt-0.5 shrink-0">
            <Loader2
              v-if="step.status === 'running'"
              class="size-3.5 animate-spin text-muted-foreground"
            />
            <CheckCircle2 v-else-if="step.status === 'done'" class="size-3.5 text-emerald-500" />
            <XCircle v-else-if="step.status === 'error'" class="size-3.5 text-destructive" />
            <Circle v-else class="size-3.5 text-muted-foreground/50" />
          </span>
          <div class="min-w-0 flex-1">
            <button
              v-if="stepExpandable(idx)"
              type="button"
              class="flex w-full items-baseline gap-1.5 text-left"
              @click="toggleStep(step.id)"
            >
              <component
                :is="expanded.has(step.id) ? ChevronDown : ChevronRight"
                class="size-3 shrink-0 text-muted-foreground"
              />
              <span class="text-[10px] text-muted-foreground">{{ idx + 1 }}.</span>
              <span class="font-mono text-foreground">{{ displayTool(step.tool) }}</span>
            </button>
            <div v-else class="flex items-baseline gap-1.5">
              <span class="w-3 shrink-0" />
              <span class="text-[10px] text-muted-foreground">{{ idx + 1 }}.</span>
              <span class="font-mono text-foreground">{{ displayTool(step.tool) }}</span>
            </div>
            <p
              v-if="step.rationale"
              class="mt-0.5 pl-[1.375rem] text-[11px] leading-snug text-muted-foreground"
            >
              {{ step.rationale }}
            </p>
          </div>
        </div>
        <div
          v-if="expanded.has(step.id) && toolCallForStep(idx)"
          class="space-y-2 border-t border-border/60 bg-muted/20 px-3 py-2 text-xs"
        >
          <div v-if="toolCallForStep(idx)!.input !== undefined">
            <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Input
            </div>
            <pre class="overflow-x-auto rounded-md bg-muted/40 p-2 text-[11px] leading-snug">{{
              safeJson(toolCallForStep(idx)!.input)
            }}</pre>
          </div>
          <div v-if="toolCallForStep(idx)!.result">
            <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Result
            </div>
            <pre
              class="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] leading-snug"
              >{{ toolCallForStep(idx)!.result!.content }}</pre
            >
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>
