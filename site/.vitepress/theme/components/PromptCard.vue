<script setup lang="ts">
import { useSiteI18n } from '../composables/useSiteI18n';
import Icon from './Icon.vue';

const { t } = useSiteI18n();
const timings = ['0.1s', '1.4s', '0.9s'];
</script>

<template>
  <div class="pc" aria-label="Example: a prompt becomes Photoshop actions">
    <div class="pc-bar">
      <span class="pc-dot" aria-hidden="true"></span>
      <span class="pc-name">photoshop-mcp</span>
      <span class="pc-model">{{ t.hero.demo.assistant }}</span>
    </div>

    <div class="pc-body">
      <div class="pc-msg">
        <div class="pc-who">{{ t.hero.demo.you }}</div>
        <p class="pc-text">{{ t.hero.demo.prompt }}</p>
      </div>

      <div class="pc-msg">
        <div class="pc-who">{{ t.hero.demo.assistant }}</div>
        <ol class="pc-steps">
          <li v-for="(s, i) in t.hero.demo.steps" :key="s" class="pc-step" :style="{ '--i': i }">
            <span class="pc-check"><Icon name="check" :size="12" /></span>
            <code class="pc-tool">{{ s }}</code>
            <span class="pc-time">{{ timings[i] }}</span>
          </li>
        </ol>

        <div class="pc-canvas" :style="{ '--i': 3 }">
          <figure class="pc-frame">
            <svg viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice" class="pc-img" role="img" aria-label="Before: portrait on a busy background">
              <defs>
                <linearGradient id="pc-busy" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#7c3aed" />
                  <stop offset="0.55" stop-color="#0e7490" />
                  <stop offset="1" stop-color="#f59e0b" />
                </linearGradient>
              </defs>
              <rect width="160" height="160" fill="url(#pc-busy)" />
              <circle cx="38" cy="46" r="24" fill="#fff" opacity="0.12" />
              <circle cx="132" cy="120" r="32" fill="#000" opacity="0.14" />
              <g class="pc-subject">
                <circle cx="80" cy="62" r="26" />
                <path d="M34 160 C34 106 126 106 126 160 Z" />
              </g>
            </svg>
            <figcaption>{{ t.hero.demo.before }}</figcaption>
          </figure>
          <span class="pc-arrow" aria-hidden="true"><Icon name="arrow" :size="18" /></span>
          <figure class="pc-frame">
            <svg viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice" class="pc-img pc-img-after" role="img" aria-label="After: subject isolated on transparency">
              <defs>
                <pattern id="pc-checker" width="16" height="16" patternUnits="userSpaceOnUse">
                  <rect width="16" height="16" fill="#e8edf5" />
                  <rect width="8" height="8" fill="#c9d3e1" />
                  <rect x="8" y="8" width="8" height="8" fill="#c9d3e1" />
                </pattern>
              </defs>
              <rect width="160" height="160" fill="url(#pc-checker)" />
              <g class="pc-subject">
                <circle cx="80" cy="62" r="26" />
                <path d="M34 160 C34 106 126 106 126 160 Z" />
              </g>
              <rect class="pc-ants" x="0.75" y="0.75" width="158.5" height="158.5" fill="none" />
            </svg>
            <figcaption>{{ t.hero.demo.after }} · 1080×1350</figcaption>
          </figure>
        </div>

        <p class="pc-result" :style="{ '--i': 4 }">
          <span class="pc-done">{{ t.hero.demo.done }}</span>
          {{ t.hero.demo.result }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pc {
  --pc-bg: #0b1220;
  --pc-line: rgba(255, 255, 255, 0.08);
  --pc-text: #e6ebf4;
  --pc-dim: #8b98b0;
  width: 100%;
  border-radius: 14px;
  border: 1px solid var(--vp-c-border);
  background: var(--pc-bg);
  color: var(--pc-text);
  box-shadow: var(--ps-shadow);
  overflow: hidden;
  font-size: var(--ps-text-sm);
}
.pc-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--pc-line);
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--pc-dim);
}
.pc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ps-ok);
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.18);
}
.pc-name {
  color: var(--pc-text);
}
.pc-model {
  margin-left: auto;
}
.pc-body {
  padding: 18px 18px 20px;
  display: grid;
  gap: 18px;
}
.pc-who {
  font-size: 0.75rem;
  color: var(--pc-dim);
  margin-bottom: 6px;
}
.pc-text {
  margin: 0;
  font-size: var(--ps-text-md);
  line-height: 1.5;
}
.pc-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.pc-step {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--pc-line);
}
.pc-check {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ps-ok);
  color: #04131c;
  flex: none;
}
.pc-tool {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  color: var(--pc-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc-time {
  margin-left: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  color: var(--pc-dim);
  flex: none;
}
.pc-canvas {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}
.pc-frame {
  margin: 0;
  flex: 1;
  min-width: 0;
}
.pc-frame figcaption {
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--pc-dim);
  font-family: var(--vp-font-family-mono);
}
.pc-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}
.pc-subject circle,
.pc-subject path {
  fill: #2b1d18;
}
.pc-img-after .pc-subject circle,
.pc-img-after .pc-subject path {
  fill: #2b1d18;
}
.pc-ants {
  stroke: #0891b2;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}
.pc-arrow {
  color: var(--ps-accent);
  flex: none;
}
.pc-result {
  margin: 12px 0 0;
  font-size: var(--ps-text-sm);
  color: var(--pc-dim);
  line-height: 1.5;
}
.pc-done {
  color: var(--ps-ok);
  font-weight: 600;
  margin-right: 6px;
}

/* one orchestrated reveal on load */
@media (prefers-reduced-motion: no-preference) {
  .pc-step,
  .pc-canvas,
  .pc-result {
    opacity: 0;
    animation: pc-in 0.45s ease forwards;
    animation-delay: calc(0.35s + var(--i) * 0.5s);
  }
  .pc-check {
    transform: scale(0.4);
    animation: pc-pop 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.4) forwards;
    animation-delay: calc(0.6s + var(--i) * 0.5s);
  }
  .pc-ants {
    animation: pc-march 0.9s linear infinite;
  }
}
@keyframes pc-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes pc-pop {
  to {
    transform: scale(1);
  }
}
@keyframes pc-march {
  to {
    stroke-dashoffset: -14;
  }
}
</style>
