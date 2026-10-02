<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Check, ExternalLink, Loader2, ShieldAlert, Trash2, Zap } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  apiCheckIntentKey,
  apiDeleteIntentKey,
  apiGetIntentRouter,
  apiSaveIntentKey,
  apiSetIntentRouter,
  type IntentKeyCheck,
  type IntentRouterStatus,
} from '@/lib/api';

const emit = defineEmits<{ saved: [] }>();

const status = ref<IntentRouterStatus | null>(null);
const loading = ref(true);
const busy = ref(false);
const draft = ref('');
const error = ref<string | null>(null);
const check = ref<IntentKeyCheck | null>(null);

const canToggle = computed(() => Boolean(status.value?.hasApiKey) && !status.value?.disabledByEnv && !busy.value);

async function load(): Promise<void> {
  loading.value = true;
  try {
    status.value = await apiGetIntentRouter();
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function run(action: () => Promise<IntentRouterStatus>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    status.value = await action();
    emit('saved');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

async function saveKey(): Promise<void> {
  const key = draft.value.trim();
  if (!key) return;
  busy.value = true;
  error.value = null;
  check.value = null;
  try {
    const result = await apiCheckIntentKey(key);
    if (!result.ok) {
      error.value = result.error ?? 'Could not verify the key.';
      return;
    }
    status.value = await apiSaveIntentKey(key);
    check.value = result;
    draft.value = '';
    emit('saved');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

async function removeKey(): Promise<void> {
  check.value = null;
  await run(apiDeleteIntentKey);
}

async function checkConnection(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const result = await apiCheckIntentKey();
    check.value = result;
    if (!result.ok) error.value = result.error ?? 'Could not verify the key.';
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

const setEnabled = (enabled: boolean) => run(() => apiSetIntentRouter({ enabled }));
const setInstant = (instant: boolean) => run(() => apiSetIntentRouter({ instant }));
</script>

<template>
  <div
    v-if="loading"
    class="flex items-center justify-center gap-2 rounded-lg border border-border py-10 text-sm text-muted-foreground"
  >
    <Loader2 class="size-4 animate-spin" />
    Loading…
  </div>

  <div v-else-if="status" class="space-y-5">
    <div class="rounded-lg border border-border p-3">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <Zap class="size-4 shrink-0 text-amber-500" />
          <span class="text-sm font-semibold">Jev by TypeSafe</span>
          <span class="rounded bg-amber-500/15 px-1 text-[9px] font-semibold uppercase text-amber-600">
            Experimental
          </span>
          <span
            v-if="status.hasApiKey"
            class="inline-flex items-center gap-1 truncate rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400"
          >
            <Check class="size-3 shrink-0" />
            {{ status.apiKeyMasked }}
          </span>
        </div>
        <a
          href="https://console.typesafe.ai/"
          target="_blank"
          rel="noreferrer"
          class="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Get key
          <ExternalLink class="size-3" />
        </a>
      </div>

      <p class="mb-3 text-xs leading-relaxed text-muted-foreground">
        Jev reads each message before your chat model does and picks a route: run known
        commands instantly, plan the rest, look at the image and iterate, or ask you first.
        It does not replace the chat model.
      </p>

      <div class="flex items-center gap-2">
        <Input
          v-model="draft"
          type="password"
          :placeholder="status.source === 'settings' ? 'Replace key…' : 'TypeSafe API key'"
          :disabled="busy"
          aria-label="TypeSafe API key"
          @keydown.enter.prevent="saveKey"
        />
        <Button size="sm" :disabled="busy || !draft.trim()" @click="saveKey">
          <Loader2 v-if="busy && draft" class="size-4 animate-spin" />
          {{ busy && draft ? 'Checking…' : 'Save' }}
        </Button>
        <Button
          v-if="status.source === 'settings'"
          size="icon"
          variant="ghost"
          :disabled="busy"
          aria-label="Remove key"
          @click="removeKey"
        >
          <Trash2 class="size-4 text-muted-foreground" />
        </Button>
      </div>

      <p v-if="status.source === 'env'" class="mt-2 text-[11px] text-muted-foreground">
        Using <code class="text-foreground">TYPESAFE_API_KEY</code> from the environment. A key saved
        here takes its place.
      </p>

      <div v-if="status.hasApiKey" class="mt-3 flex items-center gap-3">
        <Button size="sm" variant="outline" :disabled="busy" @click="checkConnection">
          <Loader2 v-if="busy && !draft" class="size-4 animate-spin" />
          Check connection
        </Button>
        <span v-if="check?.ok" class="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
          Connected · {{ check.model }} · {{ check.latencyMs }} ms
        </span>
      </div>

      <p v-if="error" class="mt-2 text-xs text-destructive">{{ error }}</p>
    </div>

    <p
      v-if="status.disabledByEnv"
      class="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
    >
      Routing is switched off by <code>PSMCP_INTENT_ROUTER=off</code> in the environment.
    </p>

    <div class="space-y-2">
      <Label>Auto route</Label>
      <p class="text-xs text-muted-foreground">
        Let Jev choose the route for every message. When off, the Action Plan switch in the
        composer decides, as before.
      </p>
      <div class="flex gap-2">
        <Button
          size="sm"
          :variant="status.enabled && status.hasApiKey ? 'default' : 'outline'"
          :disabled="!canToggle"
          @click="setEnabled(true)"
        >
          On
        </Button>
        <Button
          size="sm"
          :variant="!status.enabled || !status.hasApiKey ? 'default' : 'outline'"
          :disabled="!canToggle"
          @click="setEnabled(false)"
        >
          Off
        </Button>
      </div>
    </div>

    <div class="space-y-2">
      <Label>Instant commands</Label>
      <p class="text-xs text-muted-foreground">
        Run safe commands and recipes (undo, opacity, remove background, color grade,
        carousel…) without calling the chat model, including short chains like “black &amp;
        white, then opacity 50”. Merge and flatten always go through a plan.
      </p>
      <div class="flex gap-2">
        <Button
          size="sm"
          :variant="status.instant ? 'default' : 'outline'"
          :disabled="!canToggle || !status.enabled"
          @click="setInstant(true)"
        >
          On
        </Button>
        <Button
          size="sm"
          :variant="!status.instant ? 'default' : 'outline'"
          :disabled="!canToggle || !status.enabled"
          @click="setInstant(false)"
        >
          Off
        </Button>
      </div>
    </div>

    <div class="flex gap-2 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      <ShieldAlert class="mt-0.5 size-4 shrink-0" />
      <p>
        While Auto route is on, each message you send (and what you type in the composer) is
        also sent to <span class="text-foreground">api.typesafe.ai</span> to pick the route. The
        key is stored on this computer in <code>~/.photoshop-mcp/data.db</code>.
      </p>
    </div>
  </div>
</template>
