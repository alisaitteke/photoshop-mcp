<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLoader from './components/AppLoader.vue';
import BetaTeamModal from './components/BetaTeamModal.vue';
import Onboarding from './components/Onboarding.vue';
import ChatView from './components/ChatView.vue';
import Sidebar from './components/Sidebar.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import { useChatStore } from './stores/chat';
import {
  apiGetAnalyticsConfig,
  apiListProviders,
  apiStatus,
  type ProviderInfo,
  type Status,
} from './lib/api';
import { capture, syncAnalyticsContext } from './lib/analytics';

const status = ref<Status | null>(null);
const providers = ref<ProviderInfo[]>([]);
const loading = ref(true);
const loadingMessage = ref('Starting…');
const fatalError = ref<string | null>(null);
const settingsOpen = ref(false);
const clearingHistory = ref(false);
const clearHistoryError = ref<string | null>(null);
const betaPromptPending = ref(false);

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
    loadingMessage.value = 'Checking connection…';
    const [nextStatus, nextProviders, analyticsConfig] = await Promise.all([
      apiStatus(),
      apiListProviders(),
      apiGetAnalyticsConfig(),
    ]);
    status.value = nextStatus;
    providers.value = nextProviders;
    betaPromptPending.value = !analyticsConfig.betaTelemetryPromptAnswered;
    if (hasAnyAuth.value) {
      loadingMessage.value = 'Loading chats…';
      await chat.loadChats();
      loadingMessage.value = 'Preparing workspace…';
      await syncFromRoute();
    }
    await syncAnalyticsContext();
    capture('app_loaded', { has_auth: hasAnyAuth.value });
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

function handleBetaAnswered(): void {
  betaPromptPending.value = false;
}

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

async function handleClearHistory(): Promise<void> {
  if (chat.chats.value.length === 0) return;
  clearingHistory.value = true;
  clearHistoryError.value = null;
  try {
    await chat.clearAllChats();
    await router.replace({ name: 'home' });
  } catch (err) {
    clearHistoryError.value = (err as Error).message;
  } finally {
    clearingHistory.value = false;
  }
}

onMounted(refresh);
</script>

<template>
  <AppLoader v-if="loading" :message="loadingMessage" />
  <div v-else-if="fatalError" class="flex min-h-screen items-center justify-center p-6">
    <div class="max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {{ fatalError }}
    </div>
  </div>
  <BetaTeamModal v-else-if="betaPromptPending" @answered="handleBetaAnswered" />
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
      :action-plan-beta="status?.actionPlanBeta ?? true"
      :intent-router="status?.intentRouter?.enabled ?? false"
      @new-chat="handleNewChat"
      @open-settings="settingsOpen = true"
    />
    <SettingsDialog
      v-if="settingsOpen"
      :chat-count="chat.chats.value.length"
      :clearing-history="clearingHistory"
      :clear-history-error="clearHistoryError"
      @close="settingsOpen = false"
      @saved="handleSettingsSaved"
      @clear-history="handleClearHistory"
    />
  </div>
</template>
