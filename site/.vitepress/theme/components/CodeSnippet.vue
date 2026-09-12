<script setup lang="ts">
import CopyButton from './CopyButton.vue';

defineProps<{ code: string; filename?: string; lang?: string; cta?: string }>();
</script>

<template>
  <div class="snip">
    <div class="snip-head">
      <span class="snip-file">{{ filename ?? lang ?? 'config' }}</span>
      <CopyButton :text="code" small :cta="cta" />
    </div>
    <pre class="snip-pre"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.snip {
  min-width: 0;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--ps-radius-sm);
  background: var(--ps-ink);
  color: #dbe3f0;
  overflow: hidden;
}
.snip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 6px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.snip-file {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: #9aa7bd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.snip-pre {
  margin: 0;
  padding: 14px 16px;
  font-family: var(--vp-font-family-mono);
  font-size: var(--ps-mono-size);
  line-height: 1.55;
  overflow-x: auto;
  scrollbar-width: thin;
}
</style>
