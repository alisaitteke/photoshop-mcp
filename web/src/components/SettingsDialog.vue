<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Check, ExternalLink, Loader2, Trash2, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProviderIcon from './ProviderIcon.vue';
import {
  apiDeleteCustomProvider,
  apiDeleteKey,
  apiGetCustomProvider,
  apiListProviders,
  apiSaveCustomProvider,
  apiSaveKey,
  apiValidateCustomProvider,
  apiValidateKey,
  type CustomProviderResponse,
  type ProviderInfo,
} from '@/lib/api';

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const providers = ref<ProviderInfo[]>([]);
const drafts = ref<Record<string, string>>({});
const busy = ref<Record<string, boolean>>({});
const errors = ref<Record<string, string | null>>({});

// Custom provider state
const customCfg = ref<CustomProviderResponse | null>(null);
const customName = ref('');
const customBaseUrl = ref('');
const customApiKey = ref('');
const customApiFormat = ref<'openai' | 'anthropic'>('openai');
const customModels = ref('');
const customWebsiteUrl = ref('');
const customBusy = ref(false);
const customError = ref<string | null>(null);

async function refresh(): Promise<void> {
  [providers.value, customCfg.value] = await Promise.all([
    apiListProviders(),
    apiGetCustomProvider(),
  ]);
  if (customCfg.value) {
    customName.value = customCfg.value.name;
    customBaseUrl.value = customCfg.value.baseUrl;
    customApiFormat.value = customCfg.value.apiFormat;
    customModels.value = customCfg.value.models.map((m) => m.id).join(', ');
    customWebsiteUrl.value = customCfg.value.websiteUrl;
    customApiKey.value = '';
  }
}

onMounted(refresh);

async function saveKey(provider: ProviderInfo): Promise<void> {
  const key = drafts.value[provider.id]?.trim();
  if (!key) return;
  errors.value[provider.id] = null;
  busy.value[provider.id] = true;
  try {
    const validation = await apiValidateKey(provider.id, key);
    if (!validation.ok) {
      errors.value[provider.id] = validation.error || 'Invalid key';
      return;
    }
    await apiSaveKey(provider.id, key);
    drafts.value[provider.id] = '';
    await refresh();
    emit('saved');
  } catch (err) {
    errors.value[provider.id] = (err as Error).message;
  } finally {
    busy.value[provider.id] = false;
  }
}

async function removeKey(provider: ProviderInfo): Promise<void> {
  busy.value[provider.id] = true;
  try {
    await apiDeleteKey(provider.id);
    await refresh();
    emit('saved');
  } finally {
    busy.value[provider.id] = false;
  }
}

async function saveCustom(): Promise<void> {
  if (!customName.value.trim() || !customBaseUrl.value.trim() || !customApiKey.value.trim()) {
    customError.value = 'Name, Base URL, and API Key are required.';
    return;
  }
  const modelEntries = customModels.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => ({ id, label: id }));
  if (!modelEntries.length) {
    customError.value = 'At least one model is required.';
    return;
  }

  customError.value = null;
  customBusy.value = true;
  try {
    const validation = await apiValidateCustomProvider({
      baseUrl: customBaseUrl.value.trim(),
      apiKey: customApiKey.value.trim(),
      apiFormat: customApiFormat.value,
    });
    if (!validation.ok) {
      customError.value = validation.error || 'Validation failed.';
      return;
    }
    await apiSaveCustomProvider({
      name: customName.value.trim(),
      websiteUrl: customWebsiteUrl.value.trim(),
      apiKey: customApiKey.value.trim(),
      baseUrl: customBaseUrl.value.trim(),
      apiFormat: customApiFormat.value,
      models: modelEntries,
      defaultModel: modelEntries[0].id,
    });
    customApiKey.value = '';
    await refresh();
    emit('saved');
  } catch (err) {
    customError.value = (err as Error).message;
  } finally {
    customBusy.value = false;
  }
}

async function removeCustom(): Promise<void> {
  customBusy.value = true;
  try {
    await apiDeleteCustomProvider();
    customCfg.value = null;
    customName.value = '';
    customBaseUrl.value = '';
    customApiKey.value = '';
    customModels.value = '';
    customWebsiteUrl.value = '';
    await refresh();
    emit('saved');
  } finally {
    customBusy.value = false;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg max-h-[90vh] overflow-y-auto">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-semibold">Settings</h2>
        <Button variant="ghost" size="icon" @click="emit('close')">
          <X class="size-4" />
        </Button>
      </div>

      <div class="space-y-4">
        <h3 class="text-sm font-medium">Providers</h3>
        <div
          v-for="p in providers.filter((p) => p.id !== 'custom')"
          :key="p.id"
          class="rounded-lg border border-border p-3"
        >
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ProviderIcon :provider="p.id" :size="18" />
              <span class="text-sm font-semibold">{{ p.label }}</span>
              <span
                v-if="p.hasApiKey"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400"
              >
                <Check class="size-3" />
                {{ p.apiKeyMasked }}
              </span>
            </div>
            <a
              :href="p.apiKeyHelpUrl"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Get key
              <ExternalLink class="size-3" />
            </a>
          </div>

          <div class="flex items-center gap-2">
            <Input
              v-model="drafts[p.id]"
              type="password"
              :placeholder="p.hasApiKey ? 'Replace key…' : p.apiKeyHint"
              :disabled="busy[p.id]"
            />
            <Button
              size="sm"
              :disabled="busy[p.id] || !drafts[p.id]"
              @click="saveKey(p)"
            >
              <Loader2 v-if="busy[p.id]" class="size-4 animate-spin" />
              {{ busy[p.id] ? '…' : 'Save' }}
            </Button>
            <Button
              v-if="p.hasApiKey"
              size="icon"
              variant="ghost"
              :disabled="busy[p.id]"
              @click="removeKey(p)"
            >
              <Trash2 class="size-4 text-muted-foreground" />
            </Button>
          </div>
          <p v-if="errors[p.id]" class="mt-2 text-xs text-destructive">
            {{ errors[p.id] }}
          </p>
        </div>

        <!-- Custom Provider -->
        <div class="rounded-lg border border-border p-3">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ProviderIcon provider="custom" :size="18" />
              <span class="text-sm font-semibold">{{ customCfg?.name || 'Custom' }}</span>
              <span
                v-if="customCfg?.apiKeyPresent"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400"
              >
                <Check class="size-3" />
                {{ customCfg?.apiKey }}
              </span>
            </div>
            <Button
              v-if="customCfg?.apiKeyPresent"
              size="icon"
              variant="ghost"
              :disabled="customBusy"
              @click="removeCustom"
            >
              <Trash2 class="size-4 text-muted-foreground" />
            </Button>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Input
                v-model="customName"
                placeholder="Provider name"
                :disabled="customBusy"
                class="flex-1"
              />
              <select
                v-model="customApiFormat"
                class="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                :disabled="customBusy"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <Input
              v-model="customBaseUrl"
              placeholder="Base URL (e.g. https://api.example.com/v1)"
              :disabled="customBusy"
            />
            <Input
              v-model="customWebsiteUrl"
              placeholder="Website URL (optional)"
              :disabled="customBusy"
            />
            <Input
              v-model="customApiKey"
              type="password"
              :placeholder="customCfg?.apiKeyPresent ? 'Replace key…' : 'API key'"
              :disabled="customBusy"
            />
            <Input
              v-model="customModels"
              placeholder="Models (comma-separated, e.g. deepseek-chat, deepseek-reasoner)"
              :disabled="customBusy"
            />
            <div class="flex justify-end">
              <Button
                size="sm"
                :disabled="customBusy || !customName || !customBaseUrl || !customApiKey || !customModels"
                @click="saveCustom"
              >
                <Loader2 v-if="customBusy" class="size-4 animate-spin" />
                {{ customBusy ? '…' : 'Save' }}
              </Button>
            </div>
            <p v-if="customError" class="text-xs text-destructive">
              {{ customError }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <Button @click="emit('close')">Done</Button>
      </div>
    </div>
  </div>
</template>
