<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ExternalLink, Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import AdobeAppIcon from '@/components/AdobeAppIcon.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import {
  apiListProviders,
  apiSaveCustomProvider,
  apiSaveKey,
  apiSetActive,
  apiValidateCustomProvider,
  apiValidateKey,
  type ProviderId,
  type ProviderInfo,
} from '@/lib/api';

const emit = defineEmits<{ saved: [] }>();

const providers = ref<ProviderInfo[]>([]);
const selectedId = ref<ProviderId>('anthropic');
const apiKey = ref('');
const validating = ref(false);
const error = ref<string | null>(null);

// Custom provider fields
const customName = ref('');
const customBaseUrl = ref('');
const customApiKey = ref('');
const customApiFormat = ref<'openai' | 'anthropic'>('openai');
const customModels = ref('');

const selected = computed<ProviderInfo | undefined>(() =>
  providers.value.find((p) => p.id === selectedId.value)
);

const isCustom = computed(() => selectedId.value === 'custom');

onMounted(async () => {
  providers.value = await apiListProviders();
});

async function submit(): Promise<void> {
  error.value = null;
  validating.value = true;
  try {
    if (isCustom.value) {
      await submitCustom();
    } else {
      await submitBuiltIn();
    }
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    validating.value = false;
  }
}

async function submitBuiltIn(): Promise<void> {
  const provider = selected.value;
  if (!provider) return;
  const validation = await apiValidateKey(provider.id, apiKey.value);
  if (!validation.ok) {
    error.value = validation.error || 'Could not validate this key.';
    return;
  }
  await apiSaveKey(provider.id, apiKey.value);
  await apiSetActive({ activeProvider: provider.id, activeModel: provider.defaultModel });
  emit('saved');
}

async function submitCustom(): Promise<void> {
  if (!customName.value.trim()) {
    error.value = 'Provider name is required.';
    return;
  }
  if (!customBaseUrl.value.trim()) {
    error.value = 'Base URL is required.';
    return;
  }
  if (!customApiKey.value.trim()) {
    error.value = 'API key is required.';
    return;
  }
  const modelEntries = customModels.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => ({ id, label: id }));
  if (!modelEntries.length) {
    error.value = 'At least one model ID is required (comma-separated).';
    return;
  }

  const validation = await apiValidateCustomProvider({
    baseUrl: customBaseUrl.value.trim(),
    apiKey: customApiKey.value.trim(),
    apiFormat: customApiFormat.value,
  });
  if (!validation.ok) {
    error.value = validation.error || 'Could not validate this configuration.';
    return;
  }

  await apiSaveCustomProvider({
    name: customName.value.trim(),
    websiteUrl: '',
    apiKey: customApiKey.value.trim(),
    baseUrl: customBaseUrl.value.trim(),
    apiFormat: customApiFormat.value,
    models: modelEntries,
    defaultModel: modelEntries[0].id,
  });
  await apiSetActive({ activeProvider: 'custom', activeModel: modelEntries[0].id });
  emit('saved');
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-6">
    <Card class="w-full max-w-md">
      <CardHeader>
        <AdobeAppIcon app="ps" :size="40" class="mb-2" />
        <CardTitle>Connect an AI provider</CardTitle>
        <CardDescription>
          Photoshop MCP UI uses your own API key to talk to a model. The key is stored
          locally at <code class="text-xs">~/.photoshop-mcp/data.db</code> and never
          leaves your machine.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label>Provider</Label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="p in providers"
              :key="p.id"
              type="button"
              class="flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition"
              :class="
                selectedId === p.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-muted-foreground hover:bg-accent'
              "
              @click="selectedId = p.id"
            >
              <ProviderIcon :provider="p.id" :size="22" />
              {{ p.id === 'custom' ? 'Custom' : p.label }}
            </button>
          </div>
        </div>

        <!-- Built-in provider fields -->
        <template v-if="!isCustom">
          <div class="space-y-2">
            <Label for="api-key">API key</Label>
            <Input
              id="api-key"
              v-model="apiKey"
              type="password"
              :placeholder="selected?.apiKeyHint ?? ''"
              :disabled="validating"
              @keydown.enter="submit"
            />
          </div>
          <a
            v-if="selected"
            :href="selected.apiKeyHelpUrl"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Get an API key
            <ExternalLink class="size-3" />
          </a>
        </template>

        <!-- Custom provider fields -->
        <template v-else>
          <div class="space-y-3 rounded-lg border border-border p-3">
            <div class="space-y-2">
              <Label for="custom-name">Provider name</Label>
              <Input
                id="custom-name"
                v-model="customName"
                placeholder="e.g. DeepSeek, My Proxy"
                :disabled="validating"
              />
            </div>
            <div class="space-y-2">
              <Label for="custom-format">API format</Label>
              <select
                id="custom-format"
                v-model="customApiFormat"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                :disabled="validating"
              >
                <option value="openai">OpenAI-compatible</option>
                <option value="anthropic">Anthropic-compatible</option>
              </select>
            </div>
            <div class="space-y-2">
              <Label for="custom-base-url">Base URL</Label>
              <Input
                id="custom-base-url"
                v-model="customBaseUrl"
                placeholder="https://api.example.com/v1"
                :disabled="validating"
              />
            </div>
            <div class="space-y-2">
              <Label for="custom-api-key">API key</Label>
              <Input
                id="custom-api-key"
                v-model="customApiKey"
                type="password"
                placeholder="Your API key"
                :disabled="validating"
              />
            </div>
            <div class="space-y-2">
              <Label for="custom-models">Models (comma-separated)</Label>
              <Input
                id="custom-models"
                v-model="customModels"
                placeholder="deepseek-chat, deepseek-reasoner"
                :disabled="validating"
              />
            </div>
          </div>
        </template>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </CardContent>
      <CardFooter>
        <Button
          class="w-full"
          :disabled="validating || (isCustom ? !customApiKey || !customBaseUrl || !customName || !customModels : !apiKey || !selected)"
          @click="submit"
        >
          <Loader2 v-if="validating" class="size-4 animate-spin" />
          {{ validating ? 'Validating…' : 'Validate & save' }}
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>
