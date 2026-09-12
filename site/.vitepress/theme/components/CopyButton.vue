<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import { useSiteI18n } from '../composables/useSiteI18n';

const props = defineProps<{ text: string; label?: string; copiedLabel?: string; small?: boolean; primary?: boolean; cta?: string }>();
const { t } = useSiteI18n();
const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = props.text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  copied.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 1800);
}
</script>

<template>
  <button
    type="button"
    class="ps-btn"
    :class="[primary ? 'ps-btn-primary' : 'ps-btn-secondary', small && 'ps-btn-sm']"
    :data-cta="cta"
    @click="copy"
  >
    <Icon :name="copied ? 'check' : 'copy'" :size="16" />
    <span>{{ copied ? (copiedLabel ?? t.install.copied) : (label ?? t.install.copy) }}</span>
  </button>
</template>
