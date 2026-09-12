<script setup lang="ts">
import { useSiteI18n } from '../composables/useSiteI18n';

const { t } = useSiteI18n();
</script>

<template>
  <div class="faq">
    <details v-for="(item, i) in t.faq.items" :key="i" class="faq-item" :open="i === 0">
      <summary class="faq-q">{{ item.q }}</summary>
      <p class="faq-a">{{ item.a }}</p>
    </details>
  </div>
</template>

<style scoped>
.faq {
  border-top: 1px solid var(--vp-c-divider);
}
.faq-item {
  border-bottom: 1px solid var(--vp-c-divider);
}
.faq-q {
  cursor: pointer;
  list-style: none;
  padding: 18px 40px 18px 0;
  font-size: var(--ps-text-md);
  font-weight: 600;
  position: relative;
}
.faq-q::-webkit-details-marker {
  display: none;
}
.faq-q::after {
  content: '+';
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  font-weight: 400;
  font-size: 1.4rem;
  color: var(--vp-c-text-3);
  line-height: 1;
}
.faq-item[open] .faq-q::after {
  content: '–';
}
.faq-q:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
  border-radius: 4px;
}
.faq-a {
  margin: 0;
  padding: 0 0 20px;
  color: var(--vp-c-text-2);
  font-size: var(--ps-text-md);
  line-height: 1.6;
  max-width: 68ch;
}
</style>
