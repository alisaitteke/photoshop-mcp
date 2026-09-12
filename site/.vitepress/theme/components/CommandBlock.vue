<script setup lang="ts">
import CopyButton from './CopyButton.vue';

defineProps<{ command: string; label?: string; cta?: string }>();
</script>

<template>
  <div class="cmd">
    <div v-if="label" class="cmd-label">{{ label }}</div>
    <div class="cmd-row">
      <code class="cmd-text"><span class="cmd-prompt" aria-hidden="true">$</span>{{ command }}</code>
      <CopyButton :text="command" small :cta="cta" />
    </div>
  </div>
</template>

<style scoped>
.cmd-label {
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
}
.cmd {
  min-width: 0;
}
.cmd-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--ps-radius-sm);
  background: var(--ps-ink);
  color: #e6ebf4;
}
.cmd-text {
  flex: 1;
  min-width: 0;
  font-family: var(--vp-font-family-mono);
  font-size: var(--ps-mono-size);
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
  padding: 4px 0;
}
.cmd-prompt {
  color: var(--ps-accent);
  margin-right: 10px;
  user-select: none;
}
</style>
