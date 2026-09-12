const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const SITE_LOCALES = new Set(['tr', 'zh', 'es', 'de', 'ja']);

let initialized = false;
let productEventsBound = false;
let rybbitReady: Promise<NonNullable<Window['rybbit']> | null> | null = null;

function waitForRybbit(): Promise<NonNullable<Window['rybbit']> | null> {
  if (window.rybbit?.event) return Promise.resolve(window.rybbit);
  if (!rybbitReady) {
    rybbitReady = new Promise((resolve) => {
      const started = Date.now();
      const tick = (): void => {
        if (window.rybbit?.event) {
          resolve(window.rybbit);
          return;
        }
        if (Date.now() - started > 10_000) {
          resolve(null);
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }
  return rybbitReady;
}

function isLocalHost(): boolean {
  return LOCAL_HOSTS.has(window.location.hostname);
}

export function localeFromPath(pathOrUrl: string): string {
  let pathname = pathOrUrl;
  try {
    pathname = new URL(pathOrUrl, window.location.origin).pathname;
  } catch {
    pathname = pathOrUrl.split('?')[0] ?? pathOrUrl;
  }
  const match = pathname.match(/^\/(tr|zh|es|de|ja)(?:\/|$)/);
  const locale = match?.[1];
  return locale && SITE_LOCALES.has(locale) ? locale : 'en';
}

export function initSiteAnalytics(): void {
  if (initialized || isLocalHost()) return;
  initialized = true;
}

function capture(name: string, properties: Record<string, string>): void {
  if (!initialized) return;
  const payload = {
    event_source: 'site',
    usage_surface: 'site',
    site_locale: localeFromPath(window.location.pathname),
    ...properties,
  };
  void waitForRybbit().then((rybbit) => {
    rybbit?.event(name, payload);
  });
}

function ctaLocation(el: Element): 'hero' | 'nav' | 'footer' | 'body' {
  if (el.closest('.hero, .VPHero, .VPHomeHero')) return 'hero';
  if (el.closest('.ft, .cta')) return 'footer';
  if (el.closest('.VPNav, .VPNavBar, .VPNavScreen')) return 'nav';
  if (el.closest('.VPFooter')) return 'footer';
  return 'body';
}

function ctaIdFromLink(host: string, pathname: string): string | null {
  if (/\/docs\/getting-started\/?$/.test(pathname)) return 'get_started';
  if (/\/readme\/?$/.test(pathname)) return 'quick_start';
  if (pathname.includes('/docs/')) return 'documentation';
  if (host === 'github.com' && pathname.includes('/alisaitteke/photoshop-mcp')) return 'github';
  if ((host === 'www.npmjs.com' || host === 'npmjs.com') && pathname.includes('photoshop-mcp')) {
    return 'npm';
  }
  if (host === 'registry.modelcontextprotocol.io' || host.endsWith('.modelcontextprotocol.io')) {
    return 'mcp_registry';
  }
  return null;
}

function outboundDestination(host: string): string | null {
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (host === 'www.npmjs.com' || host === 'npmjs.com') return 'npm';
  if (host === 'registry.modelcontextprotocol.io' || host.endsWith('.modelcontextprotocol.io')) {
    return 'mcp_registry';
  }
  if (host === 'www.linkedin.com' || host === 'linkedin.com') return 'linkedin';
  if (host === 'alisait.com' || host === 'www.alisait.com') return 'alisait';
  return null;
}

function classifyCopiedCommand(text: string): 'mcp' | 'ui' | 'other' {
  if (text.includes('photoshop-mcp-ui')) return 'ui';
  if (text.includes('@alisaitteke/photoshop-mcp')) return 'mcp';
  return 'other';
}

function copiedCodeText(button: Element): string {
  const wrap = button.closest('div[class*="language-"]');
  const code = wrap?.querySelector('pre code, pre')?.textContent ?? '';
  return code.replace(/^ *(\$|>) /gm, '').trim();
}

/**
 * Install / recipe / nav controls carry data-cta="<group>:<id>" (see components).
 * Emitted as a single event so install funnels can be split by client.
 */
function handleTaggedCta(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  const node = el?.closest('[data-cta]');
  const value = node?.getAttribute('data-cta');
  if (!value) return false;
  const [group = value, id = '', variant = ''] = value.split(':');
  capture('site_cta_clicked', {
    cta_id: id ? `${group}_${id}` : group,
    cta_group: group,
    cta_target: id,
    ...(variant ? { cta_variant: variant } : {}),
    cta_location: ctaLocation(node),
  });
  return true;
}

function handleCopyClick(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  const button = el?.closest('button.copy');
  if (!button) return false;
  if (!button.closest('div[class*="language-"]')) return false;
  capture('site_code_copied', { command: classifyCopiedCommand(copiedCodeText(button)) });
  return true;
}

function handleLocaleClick(anchor: HTMLAnchorElement): boolean {
  if (!anchor.closest('.VPNavBarTranslations, .VPNavScreenTranslations')) return false;
  const to = localeFromPath(anchor.href);
  const from = localeFromPath(window.location.pathname);
  if (to === from) return false;
  capture('site_locale_changed', { from, to });
  return true;
}

function handleLinkClick(anchor: HTMLAnchorElement): void {
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return;
  }

  const ctaId = ctaIdFromLink(url.hostname, url.pathname);
  if (ctaId) {
    capture('site_cta_clicked', {
      cta_id: ctaId,
      cta_location: ctaLocation(anchor),
    });
    return;
  }

  if (url.origin === window.location.origin) return;
  const destination = outboundDestination(url.hostname);
  if (!destination) return;
  capture('site_outbound_clicked', {
    destination,
    href_host: url.hostname,
  });
}

export function bindSiteProductEvents(): void {
  if (productEventsBound || !initialized) return;
  productEventsBound = true;

  document.addEventListener(
    'click',
    (event) => {
      if (handleTaggedCta(event.target)) return;
      if (handleCopyClick(event.target)) return;
      const el = event.target instanceof Element ? event.target : null;
      const anchor = el?.closest('a');
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
      if (handleLocaleClick(anchor)) return;
      handleLinkClick(anchor);
    },
    true
  );
}
