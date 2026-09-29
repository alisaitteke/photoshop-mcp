<script setup lang="ts">
import { computed } from 'vue';
import { CircleHelp, Eye, ListChecks, Loader2, Zap } from 'lucide-vue-next';
import type { RouteView } from '@/lib/api';

const props = defineProps<{
  route: RouteView | null;
  loading?: boolean;
}>();

const STYLE = {
  instant: { icon: Zap, name: 'Instant', tone: 'text-amber-500 border-amber-500/40' },
  plan: { icon: ListChecks, name: 'Plan', tone: 'text-sky-500 border-sky-500/40' },
  agent: { icon: Eye, name: 'Look & iterate', tone: 'text-violet-500 border-violet-500/40' },
  clarify: { icon: CircleHelp, name: 'Ask first', tone: 'text-orange-500 border-orange-500/40' },
} as const;

const style = computed(() => (props.route ? STYLE[props.route.route] : null));

const detail = computed(() => {
  const r = props.route;
  if (!r) return '';
  return r.route === 'instant' ? r.label : '';
});

const meta = computed(() => {
  const r = props.route;
  if (!r) return '';
  const parts = [`${Math.round(r.confidence * 100)}%`, `${r.latencyMs} ms`];
  if (r.route === 'instant' && r.steps && r.steps > 1) parts.push(`${r.steps} steps`);
  if (r.route === 'instant') parts.push('no LLM call');
  return parts.join(' · ');
});

const pct = (n: number) => `${Math.round(n * 100)}%`;

const tooltip = computed(() => {
  const r = props.route;
  if (!r) return '';
  const lines = [`${r.reason} (${r.model})`];
  if (r.signals) {
    lines.push(
      `multi-step ${pct(r.signals.multiStep)} · specific ${pct(r.signals.actionable)} · needs a look ${pct(r.signals.needsVisual)}`
    );
  }
  return lines.join('\n');
});
</script>

<template>
  <div
    v-if="loading && !route"
    class="flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11px] text-muted-foreground shadow-sm"
  >
    <Loader2 class="size-3 animate-spin" />
    Jev is reading…
  </div>
  <div
    v-else-if="route && style"
    class="flex h-7 min-w-0 items-center gap-1.5 rounded-md border bg-card px-2 text-[11px] shadow-sm"
    :class="style.tone"
    :title="tooltip"
  >
    <component :is="style.icon" class="size-3 shrink-0" />
    <span class="font-semibold">{{ style.name }}</span>
    <span v-if="detail" class="truncate text-foreground">{{ detail }}</span>
    <span class="ml-auto shrink-0 pl-2 font-mono text-[10px] text-muted-foreground">{{ meta }}</span>
    <Loader2 v-if="loading" class="size-3 shrink-0 animate-spin opacity-70" />
  </div>
</template>
