<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Onboarding from './components/Onboarding.vue';
import ChatView from './components/ChatView.vue';
import Sidebar from './components/Sidebar.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import { useChatStore } from './stores/chat';
import {
  apiListProviders,
  apiStatus,
  type ProviderInfo,
  type Status,
} from './lib/api';

const status = ref<Status | null>(null);
const providers = ref<ProviderInfo[]>([]);
const loading = ref(true);
const fatalError = ref<string | null>(null);
const settingsOpen = ref(false);

const chat = useChatStore();
const route = useRoute();
const router = useRouter();

const hasAnyAuth = computed(() => providers.value.some((p) => p.isAuthenticated));

function routeChatId(): string | null {
  const id = route.params.id;
  return typeof id === 'string' && id ? id : null;
}

async function syncFromRoute(): Promise<void> {
  const id = routeChatId();
  if (!id) {
    if (chat.activeChatId.value !== null) {
      chat.activeChatId.value = null;
      chat.messages.splice(0, chat.messages.length);
    }
    return;
  }
  if (chat.activeChatId.value === id) return;
  if (!chat.chats.value.some((c) => c.id === id)) {
    await router.replace({ name: 'home' });
    return;
  }
  await chat.selectChat(id);
}

async function refresh(): Promise<void> {
  try {
    [status.value, providers.value] = await Promise.all([apiStatus(), apiListProviders()]);
    if (hasAnyAuth.value) {
      await chat.loadChats();
      await syncFromRoute();
    }
  } catch (err) {
    fatalError.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.params.id,
  () => {
    if (hasAnyAuth.value) void syncFromRoute();
  }
);

async function handleNewChat(): Promise<void> {
  if (!status.value) return;
  const created = await chat.newChat({
    provider: status.value.activeProvider,
    model: status.value.activeModel,
  });
  await router.push({ name: 'chat', params: { id: created.id } });
}

async function handleSelect(id: string): Promise<void> {
  await router.push({ name: 'chat', params: { id } });
}

async function handleDelete(id: string): Promise<void> {
  const wasActive = chat.activeChatId.value === id;
  await chat.removeChat(id);
  if (wasActive) {
    await router.replace({ name: 'home' });
  }
}

async function handleSettingsSaved(): Promise<void> {
  await refresh();
}

onMounted(refresh);
</script>

<template>
  <div v-if="loading" class="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
  <div v-else-if="fatalError" class="flex min-h-screen items-center justify-center p-6">
    <div class="max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {{ fatalError }}
    </div>
  </div>
  <Onboarding v-else-if="!hasAnyAuth" @saved="refresh" />
  <div v-else class="flex h-screen">
    <Sidebar
      :chats="chat.chats.value"
      :active-chat-id="chat.activeChatId.value"
      @new-chat="handleNewChat"
      @select="handleSelect"
      @rename="(id, title) => chat.rename(id, title)"
      @delete="handleDelete"
      @open-settings="settingsOpen = true"
    />
    <ChatView
      class="flex-1"
      :providers="providers"
      :store="chat"
      :settings-open="settingsOpen"
      :action-plan-beta="status?.actionPlanBeta ?? false"
      :has-api-key="status?.hasApiKey ?? false"
      @new-chat="handleNewChat"
      @open-settings="settingsOpen = true"
    />
    <SettingsDialog
      v-if="settingsOpen"
      @close="settingsOpen = false"
      @saved="handleSettingsSaved"
    />
  </div>
</template>
