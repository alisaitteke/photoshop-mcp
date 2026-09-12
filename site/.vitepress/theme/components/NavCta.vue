<script setup lang="ts">
import { useSiteI18n } from '../composables/useSiteI18n';

const { t, link } = useSiteI18n();
</script>

<template>
  <a :href="link('/docs/getting-started')" class="ps-btn ps-btn-primary ps-btn-sm ps-nav-cta" data-cta="nav:get-started">
    {{ t.nav.getStarted }}
  </a>
</template>
