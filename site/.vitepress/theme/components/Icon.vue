<script setup lang="ts">
defineProps<{ name: 'download' | 'terminal' | 'link' | 'check' | 'copy' | 'search' | 'arrow' | 'chevron' | 'external' | 'play'; size?: number }>();
const PATHS: Record<string, string> = {
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  terminal: 'M4 5h16v14H4zM7 9l3 3-3 3M12 15h5',
  link: 'M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4-4',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'M6 9l6 6 6-6',
  external: 'M14 4h6v6M20 4l-9 9M18 13v7H4V6h7',
  play: 'M7 5v14l11-7z',
};
</script>

<template>
  <svg
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
