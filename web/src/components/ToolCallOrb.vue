<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { displayToolName } from '@/lib/tool-display';
import { getToolIcon } from '@/lib/tool-icons';

export type ToolOrbStatus = 'pending' | 'running' | 'done' | 'error' | 'success';

const props = withDefaults(
  defineProps<{
    name: string;
    status: ToolOrbStatus;
    disabled?: boolean;
    index?: number;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  click: [];
}>();

const label = computed(() => {
  const tool = displayToolName(props.name);
  if (props.index !== undefined) return `${props.index + 1}. ${tool}`;
  return tool;
});

const icon = computed(() => getToolIcon(props.name));

const isActive = computed(() => props.status === 'pending' || props.status === 'running');

const borderClass = computed(() => {
  if (props.status === 'error') return 'border-destructive/60';
  if (props.status === 'done' || props.status === 'success') return 'border-emerald-500/60';
  if (props.status === 'running') return 'border-foreground/30';
  return 'border-border';
});

const ariaLabel = computed(() => {
  const state =
    props.status === 'running'
      ? 'running'
      : props.status === 'pending'
        ? 'pending'
        : props.status === 'error'
          ? 'failed'
          : 'completed';
  return `${label.value} (${state})`;
});

function onClick(): void {
  if (props.disabled) return;
  emit('click');
}
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          :disabled="disabled"
          :aria-label="ariaLabel"
          class="relative flex size-10 shrink-0 items-center justify-center rounded-full border bg-card/80 text-muted-foreground transition-colors hover:bg-muted/60 disabled:cursor-default disabled:opacity-60"
          :class="borderClass"
          @click="onClick"
        >
          <component
            :is="icon"
            class="size-4"
            :class="name === '…' ? 'animate-pulse' : ''"
          />
          <span
            v-if="isActive"
            class="absolute inset-0 flex items-center justify-center rounded-full bg-card/70"
          >
            <Loader2 class="size-3.5 animate-spin text-muted-foreground" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p class="max-w-xs font-mono text-xs">{{ label }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
