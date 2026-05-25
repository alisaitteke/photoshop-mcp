<script setup lang="ts">
import { computed } from 'vue';
import { Globe } from 'lucide-vue-next';
import anthropicIcon from '@lobehub/icons-static-svg/icons/anthropic.svg?url';
import openaiIcon from '@lobehub/icons-static-svg/icons/openai.svg?url';
import openrouterIcon from '@lobehub/icons-static-svg/icons/openrouter.svg?url';
import geminiIcon from '@lobehub/icons-static-svg/icons/gemini-color.svg?url';
import type { ProviderId } from '@/lib/api';

const ICONS: Partial<Record<ProviderId, string>> = {
  anthropic: anthropicIcon,
  openai: openaiIcon,
  openrouter: openrouterIcon,
  google: geminiIcon,
};

const LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  google: 'Google',
  custom: 'Custom',
};

// Mono brand marks (black on transparent) need to be inverted in dark mode so
// they remain visible. The Gemini mark is full color and is used as-is.
const MONO: Partial<Record<ProviderId, boolean>> = {
  anthropic: true,
  openai: true,
  openrouter: true,
  google: false,
};

const props = withDefaults(
  defineProps<{
    provider: ProviderId;
    size?: number;
  }>(),
  { size: 16 }
);

const src = computed(() => ICONS[props.provider]);
const alt = computed(() => LABELS[props.provider]);
const isMono = computed(() => MONO[props.provider] ?? false);
const hasImg = computed(() => Boolean(src.value));
</script>

<template>
  <img
    v-if="hasImg"
    :src="src"
    :alt="alt"
    :width="props.size"
    :height="props.size"
    :class="['provider-icon', { 'provider-icon--mono': isMono }]"
    decoding="async"
    loading="lazy"
  />
  <Globe
    v-else
    :size="props.size"
    class="provider-icon text-muted-foreground"
  />
</template>

<style>
.provider-icon {
  display: inline-block;
  flex: none;
  object-fit: contain;
}

.dark .provider-icon--mono {
  filter: invert(1);
}
</style>
