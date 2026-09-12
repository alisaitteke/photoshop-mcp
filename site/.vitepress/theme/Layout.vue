<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import { computed } from 'vue';
import SiteFooter from './components/SiteFooter.vue';
import NavCta from './components/NavCta.vue';

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
/** Docs pages keep VitePress' own footer/edit link; marketing pages get ours. */
const wideFooter = computed(() => frontmatter.value.layout === 'page');
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <NavCta />
    </template>
    <template v-if="wideFooter" #page-bottom>
      <SiteFooter />
    </template>
    <template v-else #doc-after>
      <div class="doc-footer-spacer" />
    </template>
    <template v-if="!wideFooter" #layout-bottom>
      <SiteFooter />
    </template>
  </Layout>
</template>

<style scoped>
.doc-footer-spacer {
  height: 8px;
}
</style>
