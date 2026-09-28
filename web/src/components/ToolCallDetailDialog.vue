<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { Loader2, X } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import JsonHighlight from '@/components/JsonHighlight.vue';
import { displayToolName } from '@/lib/tool-display';
import PreviewImage from './PreviewImage.vue';
import type { ToolResult } from '@/lib/api';
import type { ToolStepStatus } from '@/lib/tool-result-status';
import { formatDuration } from '@/lib/tool-summary';

const props = defineProps<{
  open: boolean;
  name: string;
  status: ToolStepStatus;
  input?: unknown;
  result?: ToolResult;
  rationale?: string;
  durationMs?: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) emit('close');
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function badgeVariant(): 'success' | 'destructive' | 'secondary' {
  if (props.status === 'success' || props.status === 'done') return 'success';
  if (props.status === 'error') return 'destructive';
  return 'secondary';
}

function statusLabel(): string {
  if (props.status === 'success') return 'success';
  return props.status;
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur"
      @click.self="emit('close')"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
        role="dialog"
        aria-modal="true"
        :aria-label="displayToolName(name)"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate font-mono text-sm font-semibold text-foreground">
              {{ displayToolName(name) }}
            </h2>
            <div class="mt-1.5 flex items-center gap-2">
              <Loader2
                v-if="status === 'pending' || status === 'running'"
                class="size-3.5 animate-spin text-muted-foreground"
              />
              <Badge :variant="badgeVariant()" class="text-[10px] capitalize">
                {{ statusLabel() }}
              </Badge>
              <span v-if="formatDuration(durationMs)" class="font-mono text-[11px] text-muted-foreground">
                {{ formatDuration(durationMs) }}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" @click="emit('close')">
            <X class="size-4" />
          </Button>
        </div>

        <p
          v-if="rationale"
          class="mb-4 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
        >
          {{ rationale }}
        </p>

        <div class="space-y-3 text-xs">
          <div v-if="input !== undefined">
            <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Input
            </div>
            <JsonHighlight :value="input" />
          </div>
          <div v-if="result">
            <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Result
            </div>
            <div v-if="result.images?.length" class="mb-2 space-y-2">
              <PreviewImage
                v-for="image in result.images"
                :key="image.file"
                :image="image"
                :alt="`${displayToolName(name)} result`"
              />
            </div>
            <pre class="max-h-64 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] leading-snug">{{
              result.content
            }}</pre>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
