<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, Check, Lock } from 'lucide-vue-next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import ProviderIcon from './ProviderIcon.vue';
import type { ProviderId, ProviderInfo, ProviderModel } from '@/lib/api';

const props = defineProps<{
  providers: ProviderInfo[];
  currentProvider: ProviderId;
  currentModel: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [value: { provider: ProviderId; model: string }];
  'open-settings': [];
}>();

const open = ref(false);

const provider = computed<ProviderInfo | undefined>(() =>
  props.providers.find((p) => p.id === props.currentProvider)
);

const model = computed(() =>
  provider.value?.models.find((m) => m.id === props.currentModel)
);

function onModelClick(prov: ProviderInfo, mdl: ProviderModel): void {
  if (!prov.isAuthenticated) {
    open.value = false;
    emit('open-settings');
    return;
  }
  if (prov.id !== props.currentProvider || mdl.id !== props.currentModel) {
    emit('select', { provider: prov.id, model: mdl.id });
  }
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :disabled="disabled"
        class="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <ProviderIcon :provider="currentProvider" :size="14" />
        <span class="font-normal">
          Model:
          <span class="font-medium text-foreground">
            {{ model?.label ?? 'Select model' }}
          </span>
        </span>
        <ChevronDown class="size-3.5 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-80 p-0" align="start" side="top">
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="prov in providers"
          :key="prov.id"
          class="border-b border-border/50 last:border-0"
        >
          <div
            class="flex items-center justify-between gap-2 bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <span class="inline-flex items-center gap-1.5">
              <ProviderIcon :provider="prov.id" :size="14" />
              {{ prov.label }}
            </span>
            <span
              v-if="!prov.isAuthenticated"
              class="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80"
            >
              <Lock class="size-3" />
              {{ prov.authMethod === 'cli_account' ? 'Connect account' : 'Add API key' }}
            </span>
          </div>
          <div class="py-1">
            <button
              v-for="mdl in prov.models"
              :key="mdl.id"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              :class="[
                prov.isAuthenticated
                  ? 'hover:bg-accent'
                  : 'opacity-50 hover:bg-muted/30',
                prov.id === currentProvider && mdl.id === currentModel
                  ? 'bg-accent'
                  : '',
              ]"
              @click="onModelClick(prov, mdl)"
            >
              <Check
                v-if="prov.isAuthenticated"
                class="size-4 shrink-0"
                :class="
                  prov.id === currentProvider && mdl.id === currentModel
                    ? 'opacity-100'
                    : 'opacity-0'
                "
              />
              <Lock v-else class="size-3.5 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{{ mdl.label }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
