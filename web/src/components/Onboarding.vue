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
  apiSetAuthMethod,
  apiSetCliPath,
  apiValidateCli,
  apiValidateCustomProvider,
  apiValidateKey,
  type AuthMethod,
  type ProviderId,
  type ProviderInfo,
} from '@/lib/api';
import { capture } from '@/lib/analytics';
import { formatCliAuthError } from '@/lib/cli-auth-errors';

const emit = defineEmits<{ saved: [] }>();

const providers = ref<ProviderInfo[]>([]);
const selectedId = ref<ProviderId>('anthropic');
const authMethod = ref<AuthMethod>('api_key');
const apiKey = ref('');
const cliPath = ref('');
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

const supportsCliAccount = computed(
  () => !isCustom.value && (selected.value?.supportedAuthMethods.includes('cli_account') ?? false)
);

const CLI_INSTALL: Partial<Record<ProviderId, { install: string; login: string }>> = {
  anthropic: {
    install: 'npm install -g @anthropic-ai/claude-code',
    login: 'claude auth login',
  },
  google: {
    install: 'npm install -g @google/gemini-cli',
    login: 'gemini auth login',
  },
};

onMounted(async () => {
  providers.value = await apiListProviders();
});

async function selectProvider(id: ProviderId): Promise<void> {
  selectedId.value = id;
  const provider = providers.value.find((p) => p.id === id);
  authMethod.value = provider?.authMethod ?? 'api_key';
  error.value = null;
  capture('setup_provider_selected', { provider_id: id });
}

async function selectAuthMethod(method: AuthMethod): Promise<void> {
  authMethod.value = method;
  error.value = null;
  if (selected.value) {
    // setup_auth_method_selected is captured server-side in /api/providers/:id/auth-method.
    await apiSetAuthMethod(selected.value.id, method);
  }
}

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
  if (authMethod.value === 'api_key') {
    const validation = await apiValidateKey(provider.id, apiKey.value);
    if (!validation.ok) {
      error.value = validation.error || 'Could not validate this key.';
      return;
    }
    await apiSaveKey(provider.id, apiKey.value);
  } else {
    const path = cliPath.value.trim();
    if (path) {
      await apiSetCliPath(provider.id, path);
    }
    const validation = await apiValidateCli(provider.id);
    if (!validation.ok) {
      error.value = formatCliAuthError(
        validation.error,
        provider.id,
        validation.detail
      );
      return;
    }
  }
  await apiSetActive({ activeProvider: provider.id, activeModel: provider.defaultModel });
  capture('setup_completed', {
    provider_id: provider.id,
    auth_method: authMethod.value,
  });
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
  capture('setup_completed', { provider_id: 'custom', auth_method: 'api_key' });
  emit('saved');
}

const canSubmit = computed(() => {
  if (!selected.value) return false;
  if (isCustom.value) {
    return Boolean(
      customApiKey.value.trim() &&
        customBaseUrl.value.trim() &&
        customName.value.trim() &&
        customModels.value.trim()
    );
  }
  if (authMethod.value === 'api_key') return Boolean(apiKey.value.trim());
  return true;
});

function cliPathPlaceholder(provider: ProviderInfo): string {
  return provider.cliBinaryName
    ? `/usr/local/bin/${provider.cliBinaryName}`
    : 'Optional custom path';
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-6">
    <Card class="w-full max-w-md">
      <CardHeader>
        <AdobeAppIcon app="ps" :size="40" class="mb-2" />
        <CardTitle>Connect an AI provider</CardTitle>
        <CardDescription>
          Use your own API key or sign in with a CLI subscription account. Credentials
          are stored locally at
          <code class="text-xs">~/.photoshop-mcp/data.db</code> and never leave your
          machine.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label>Provider</Label>
          <div class="grid grid-cols-2 gap-2">
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
              @click="selectProvider(p.id)"
            >
              <ProviderIcon :provider="p.id" :size="22" />
              {{ p.id === 'custom' ? 'Custom' : p.label }}
            </button>
          </div>
        </div>

        <template v-if="!isCustom">
          <div v-if="supportsCliAccount" class="space-y-2">
            <Label>Authentication</Label>
            <div class="flex gap-2">
              <Button
                size="sm"
                class="flex-1"
                :variant="authMethod === 'api_key' ? 'default' : 'outline'"
                @click="selectAuthMethod('api_key')"
              >
                API key
              </Button>
              <Button
                size="sm"
                class="flex-1"
                :variant="authMethod === 'cli_account' ? 'default' : 'outline'"
                @click="selectAuthMethod('cli_account')"
              >
                Uses your account
              </Button>
            </div>
          </div>

          <template v-if="authMethod === 'api_key'">
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

          <template v-else-if="selected && CLI_INSTALL[selected.id]">
            <div class="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <p class="font-medium text-foreground">Set up the CLI first</p>
              <p class="mt-2">
                Install:
                <code class="text-foreground">{{ CLI_INSTALL[selected.id]!.install }}</code>
              </p>
              <p class="mt-1">
                Login:
                <code class="text-foreground">{{ CLI_INSTALL[selected.id]!.login }}</code>
              </p>
              <p class="mt-2">
                Anthropic API keys and Agent SDK sessions do not apply here — use
                <strong>API key</strong> auth if that is how you already connect.
              </p>
              <p class="mt-2">
                Then click validate — usage counts against your subscription quota, not API
                billing.
              </p>
            </div>
            <div class="space-y-2">
              <Label for="cli-path">CLI path (optional)</Label>
              <Input
                id="cli-path"
                v-model="cliPath"
                :placeholder="cliPathPlaceholder(selected)"
                :disabled="validating"
              />
            </div>
          </template>
        </template>

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

        <p v-if="error" class="whitespace-pre-line text-sm text-destructive">{{ error }}</p>
      </CardContent>
      <CardFooter>
        <Button class="w-full" :disabled="validating || !canSubmit" @click="submit">
          <Loader2 v-if="validating" class="size-4 animate-spin" />
          {{
            validating
              ? 'Validating…'
              : isCustom || authMethod === 'api_key'
                ? 'Validate & save'
                : 'Check connection & continue'
          }}
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>
