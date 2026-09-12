import { computed } from 'vue';
import { useData } from 'vitepress';
import en from '../../../i18n/en.json';
import tr from '../../../i18n/tr.json';
import zh from '../../../i18n/zh.json';
import es from '../../../i18n/es.json';
import de from '../../../i18n/de.json';
import ja from '../../../i18n/ja.json';

export type Strings = typeof en;

const TABLE: Record<string, Strings> = { en, tr, zh, es, de, ja } as Record<string, Strings>;

export function localeKey(lang: string): string {
  const k = (lang || 'en').toLowerCase().split('-')[0];
  return TABLE[k] ? k : 'en';
}

/** Path prefix for the current locale ('' for English, '/tr' for Turkish…). */
export function localePrefix(lang: string): string {
  const k = localeKey(lang);
  return k === 'en' ? '' : `/${k}`;
}

export function useSiteI18n() {
  const { lang } = useData();
  const key = computed(() => localeKey(lang.value));
  const t = computed<Strings>(() => TABLE[key.value]);
  const prefix = computed(() => localePrefix(lang.value));
  /** Replace {name}-style placeholders. */
  const fmt = (template: string, vars: Record<string, string | number>): string =>
    template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
  /** Locale-aware internal link. Docs stay English. */
  const link = (path: string): string => {
    if (path.startsWith('/docs/') && path !== '/docs/getting-started') return path;
    return `${prefix.value}${path}`;
  };
  return { t, fmt, link, prefix, key };
}
