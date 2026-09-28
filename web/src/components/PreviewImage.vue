<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { ImageOff, X } from 'lucide-vue-next';
import { previewObjectUrl, type ToolImageRef } from '@/lib/api';
import { usePreviewChatId } from '@/lib/preview-context';

const props = withDefaults(
  defineProps<{
    image: ToolImageRef;
    alt: string;
    /** 'thumb' for timeline rows, 'hero' for the turn result. */
    size?: 'thumb' | 'hero';
  }>(),
  { size: 'hero' }
);

const chatId = usePreviewChatId();
const src = ref<string | null>(null);
const failed = ref(false);
const zoomed = ref(false);

async function load(): Promise<void> {
  failed.value = false;
  const id = chatId?.value;
  if (!id) {
    failed.value = true;
    return;
  }
  try {
    src.value = await previewObjectUrl(id, props.image.file);
  } catch {
    failed.value = true;
  }
}

watch(() => [props.image.file, chatId?.value], load);
onMounted(load);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && zoomed.value) zoomed.value = false;
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <button
    type="button"
    class="group relative block overflow-hidden rounded-md border border-border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--photoshop-blue)]"
    :class="size === 'thumb' ? 'h-10 w-14 shrink-0' : 'w-full'"
    :aria-label="`Enlarge ${alt}`"
    :disabled="!src"
    @click.stop="zoomed = true"
  >
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="block"
      :class="size === 'thumb' ? 'h-full w-full object-cover' : 'max-h-[420px] w-full object-contain'"
    />
    <div
      v-else-if="failed"
      class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"
      :class="size === 'thumb' ? 'h-full w-full' : 'h-32 w-full'"
    >
      <ImageOff class="size-3.5" />
      <span v-if="size === 'hero'">Preview unavailable</span>
    </div>
    <div
      v-else
      class="animate-pulse bg-muted/60"
      :class="size === 'thumb' ? 'h-full w-full' : 'h-56 w-full'"
    />
  </button>

  <Teleport to="body">
    <div
      v-if="zoomed && src"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      :aria-label="alt"
      @click.self="zoomed = false"
    >
      <img :src="src" :alt="alt" class="max-h-full max-w-full rounded-md shadow-2xl" />
      <button
        type="button"
        class="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Close preview"
        @click="zoomed = false"
      >
        <X class="size-4" />
      </button>
    </div>
  </Teleport>
</template>
