<script setup lang="ts">
import { computed } from 'vue';
import type { ClientDef, Os } from '../../../data/clients';
import { deriveConfig } from '../../../data/clients';
import { useSiteI18n } from '../composables/useSiteI18n';
import CommandBlock from './CommandBlock.vue';
import CodeSnippet from './CodeSnippet.vue';
import CopyButton from './CopyButton.vue';
import Icon from './Icon.vue';

const props = defineProps<{ client: ClientDef; os: Os }>();
const { t, fmt, link, key } = useSiteI18n();
const cfg = deriveConfig();

const primaryHref = computed(() => props.client.deeplink?.(cfg));
const unavailable = computed(() => !props.client.platforms.includes(props.os));
const configPath = computed(() => {
  const paths = props.client.config?.paths;
  if (!paths) return undefined;
  return paths[props.os] ?? paths.mac ?? paths.windows ?? paths.linux;
});
const filename = computed(() => {
  const p = configPath.value;
  if (p) return p.split(/[\\/]/).pop();
  return props.client.config?.format === 'toml' ? 'config.toml' : 'mcp.json';
});
const docsHref = computed(() =>
  props.client.docs.startsWith('/') ? link(props.client.docs) : props.client.docs,
);
const isExternalDocs = computed(() => !props.client.docs.startsWith('/'));
// Per-client hints are English-only; other locales get the translated generic line.
const verifyText = computed(() =>
  key.value === 'en' ? (props.client.verifyHint ?? t.value.install.verifyExpect) : t.value.install.verifyExpect,
);
</script>

<template>
  <div class="card" :data-client="client.id">
    <div class="card-head">
      <div>
        <h3 class="card-title">{{ client.name }}</h3>
        <p v-if="client.maker" class="card-maker">{{ client.maker }}</p>
      </div>
      <a :href="docsHref" class="card-docs" :target="isExternalDocs ? '_blank' : undefined" rel="noopener">
        {{ fmt(t.install.docs, { name: client.name }) }}
        <Icon :name="isExternalDocs ? 'external' : 'arrow'" :size="14" />
      </a>
    </div>

    <p v-if="unavailable" class="ps-caution">{{ fmt(t.install.notAvailable, { os: t.install.os[os] }) }}</p>
    <p v-if="client.caution" class="ps-caution">{{ client.caution }}</p>

    <!-- primary action (config-only clients have none; the snippet below is the action) -->
    <div v-if="primaryHref || client.cli" class="card-primary">
      <template v-if="client.mechanism === 'deeplink' && primaryHref">
        <a :href="primaryHref" class="ps-btn ps-btn-primary ps-ants" :data-cta="`install:${client.id}`">
          <Icon name="link" :size="16" />
          {{ fmt(t.install.installIn, { name: client.name }) }}
        </a>
      </template>
      <template v-else-if="client.mechanism === 'download' && primaryHref">
        <a :href="primaryHref" class="ps-btn ps-btn-primary ps-ants" :data-cta="`install:${client.id}`">
          <Icon name="download" :size="16" />
          {{ fmt(t.install.downloadFor, { name: client.name }) }}
        </a>
        <span class="card-note">{{ t.install.mcpbNote }}</span>
      </template>
      <template v-else-if="client.cli">
        <CommandBlock :command="client.cli" :label="t.install.command" :cta="`install:${client.id}`" />
      </template>
    </div>

    <ol v-if="client.steps?.length" class="card-steps">
      <li v-for="s in client.steps" :key="s">{{ s }}</li>
    </ol>

    <!-- secondary: cli for deeplink clients, config for everyone -->
    <div v-if="client.cli && client.mechanism !== 'cli'" class="card-block">
      <CommandBlock :command="client.cli" :label="t.install.command" :cta="`install:${client.id}:cli`" />
    </div>

    <div v-if="client.config" class="card-block">
      <div class="card-block-label">
        {{ client.mechanism === 'deeplink' || client.mechanism === 'download' ? t.install.fallback : t.install.configFile }}
      </div>
      <CodeSnippet
        :code="client.config.snippet"
        :filename="filename"
        :lang="client.config.format"
        :cta="`install:${client.id}:config`"
      />
      <p v-if="configPath || client.config.location" class="card-where">
        <span class="card-where-label">{{ t.install.configWhere }}</span>
        <code v-if="configPath" class="ps-mono">{{ configPath }}</code>
        <span v-if="client.config.location">{{ client.config.location }}</span>
      </p>
    </div>

    <!-- verify -->
    <div class="card-verify">
      <div class="card-block-label">{{ t.install.verify }}</div>
      <div class="verify-row">
        <code class="verify-prompt">{{ t.install.verifyPrompt }}</code>
        <CopyButton :text="t.install.verifyPrompt" small />
      </div>
      <p class="verify-expect">{{ verifyText }}</p>
    </div>
  </div>
</template>

<style scoped>
.card > * {
  /* grid items default to min-width: auto, which lets code blocks widen the card */
  min-width: 0;
}
.card {
  border: 1px solid var(--vp-c-border);
  border-radius: var(--ps-radius);
  background: var(--ps-panel);
  padding: 24px;
  display: grid;
  gap: 18px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.card-title {
  margin: 0;
  font-size: var(--ps-text-xl);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.2;
  border: none;
  padding: 0;
}
.card-maker {
  margin: 2px 0 0;
  color: var(--vp-c-text-3);
  font-size: var(--ps-text-sm);
}
.card-docs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--ps-text-sm);
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  margin-top: 6px;
}
.card-docs:hover {
  text-decoration: underline;
}
.card-primary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.card-primary :deep(.cmd) {
  width: 100%;
}
.card-note {
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-3);
}
.card-steps {
  margin: 0;
  padding-left: 20px;
  color: var(--vp-c-text-2);
  font-size: var(--ps-text-sm);
  line-height: 1.55;
  display: grid;
  gap: 4px;
}
.card-block {
  display: grid;
  gap: 8px;
}
.card-block-label {
  font-size: var(--ps-text-sm);
  font-weight: 600;
}
.card-where {
  margin: 0;
  font-size: var(--ps-text-xs);
  color: var(--vp-c-text-2);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: baseline;
}
.card-where-label {
  color: var(--vp-c-text-3);
}
.card-where code {
  font-size: 0.8rem;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
}
.card-verify {
  border-top: 1px dashed var(--vp-c-border);
  padding-top: 16px;
  display: grid;
  gap: 8px;
}
.verify-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.verify-prompt {
  font-family: var(--vp-font-family-base);
  font-size: var(--ps-text-md);
  padding: 8px 12px;
  border-radius: var(--ps-radius-sm);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
}
.verify-expect {
  margin: 0;
  font-size: var(--ps-text-sm);
  color: var(--vp-c-text-2);
}
</style>
