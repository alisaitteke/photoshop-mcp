import { onMounted, ref, watch } from 'vue';
import type { Os } from '../../../data/clients';

const STORAGE_KEY = 'psmcp.client';
const OS_KEY = 'psmcp.os';

const selected = ref<string>('cursor');
const os = ref<Os>('mac');
let hydrated = false;

/** Photoshop only runs on macOS and Windows, so those are the only choices offered. */
function detectOs(): Os {
  if (typeof navigator === 'undefined') return 'mac';
  return /Windows/i.test(navigator.userAgent) ? 'windows' : 'mac';
}

function hydrate(validIds: string[]): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('client');
  const fromStore = window.localStorage.getItem(STORAGE_KEY);
  const pick = [fromUrl, fromStore].find((v) => v && validIds.includes(v));
  if (pick) selected.value = pick;
  const storedOs = window.localStorage.getItem(OS_KEY) as Os | null;
  os.value = storedOs === 'mac' || storedOs === 'windows' ? storedOs : detectOs();

  watch(selected, (v) => {
    window.localStorage.setItem(STORAGE_KEY, v);
    const u = new URL(window.location.href);
    u.searchParams.set('client', v);
    window.history.replaceState(window.history.state, '', u);
  });
  watch(os, (v) => window.localStorage.setItem(OS_KEY, v));
}

/** Shared client + OS selection (hero install strip and Getting Started tabs stay in sync). */
export function useClientChoice(validIds: string[]) {
  onMounted(() => hydrate(validIds));
  return { selected, os };
}
