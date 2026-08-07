import { serve, type ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  capture,
  captureBetaChatTurn,
  ensureAnalyticsIdentity,
  getAnalyticsRuntimeConfig,
  identifyUiModelSelection,
  resetAnalyticsProvider,
  setBetaTelemetryChoice,
  shutdownAnalytics,
} from '../analytics/index.js';
import { setAnalyticsOptOut } from '../analytics/identity.js';
import { Logger } from '../utils/logger.js';
import {
  buildHistory,
  runChat,
  type AssistantBuffer,
  type RunChatFinishInfo,
} from './agent.js';
import {
  deleteCustomProvider,
  getAuthMethod,
  getCustomProvider,
  getProviderConfig,
  isProviderConfigAuthenticated,
  loadConfig,
  maskApiKey,
  saveConfig,
  saveCustomProvider,
  setProviderConfig,
  type AuthMethod,
  type CustomProviderConfig,
  type ProviderId,
} from './config.js';
import { getProvider, listProviders } from './providers/registry.js';
import {
  createSessionToken,
  extractRequestToken,
  matchesSessionToken,
  removeSessionFile,
  SESSION_TOKEN_HEADER,
  writeSessionFile,
} from './security/session-token.js';
import {
  appendMessage,
  createChat,
  deleteChat,
  getChat,
  getMessages,
  listChats,
  renameChat,
  updateChatModel,
} from './store/chats.js';
import { getDB } from './store/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/ui/server.js -> ../../web/dist
const WEB_DIST = resolve(__dirname, '..', '..', 'web', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

export interface UIServerOptions {
  port: number;
  host: string;
  /** Overrides the generated session token; primarily for tests. */
  token?: string;
}

export interface UIServer {
  url: string;
  /** Shared secret every `/api/*` request must present. */
  token: string;
  close(): Promise<void>;
}

export async function startUIServer(opts: UIServerOptions): Promise<UIServer> {
  const logger = new Logger('UIServer');
  const app = new Hono();

  // Initialize the SQLite database eagerly so the first request is fast and
  // any migration error surfaces during startup instead of mid-request.
  getDB();
  ensureAnalyticsIdentity();

  const token = opts.token ?? createSessionToken();
  writeSessionFile({ token, port: opts.port, pid: process.pid });

  const abortControllers = new Map<string, AbortController>();

  // `/api/*` reads and writes LLM provider credentials and drives Photoshop, so
  // it is gated by three independent controls: a Host check (DNS rebinding), an
  // Origin check (cross-origin browser callers), and a per-session token (local
  // non-browser processes, which can forge any header but cannot read the
  // token). Fetch metadata is only ever used to reject, never to grant trust.
  app.use('/api/*', async (c, next) => {
    const host = parseHostHeader(c.req.header('host'));
    if (!host || !isAllowedHost(host, opts)) {
      return c.json({ error: 'invalid_host' }, 403);
    }

    const origin = c.req.header('origin');
    if (origin !== undefined && !isAllowedOrigin(origin, host.hostname, opts.port)) {
      return c.json({ error: 'invalid_origin' }, 403);
    }

    if (c.req.header('sec-fetch-site') === 'cross-site') {
      return c.json({ error: 'invalid_origin' }, 403);
    }

    const presented = extractRequestToken({
      token: c.req.header(SESSION_TOKEN_HEADER),
      authorization: c.req.header('authorization'),
    });
    if (!matchesSessionToken(presented, token)) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    return next();
  });

  // ---- Analytics ----------------------------------------------------------

  app.get('/api/analytics/config', (c) => {
    const config = getAnalyticsRuntimeConfig();
    return c.json({
      enabled: config.enabled,
      provider: config.provider,
      distinctId: config.distinctId,
      key: config.key,
      apiHost: config.apiHost,
      uiHost: config.uiHost,
      betaTelemetryOptIn: config.betaTelemetryOptIn,
      betaTelemetryPromptAnswered: config.betaTelemetryPromptAnswered,
    });
  });

  app.post('/api/analytics/beta-telemetry', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { optedIn?: boolean };
    const optedIn = Boolean(body.optedIn);
    setBetaTelemetryChoice(optedIn);
    return c.json({
      ok: true,
      betaTelemetryOptIn: optedIn,
      betaTelemetryPromptAnswered: true,
    });
  });

  app.post('/api/analytics/opt-out', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { optedOut?: boolean };
    const optedOut = Boolean(body.optedOut);
    if (optedOut) {
      await shutdownAnalytics();
    }
    setAnalyticsOptOut(optedOut);
    resetAnalyticsProvider();
    return c.json({ ok: true, optedOut });
  });

  // ---- Status -------------------------------------------------------------

  app.get('/api/status', async (c) => {
    const config = loadConfig();
    const active = config.providers[config.activeProvider];
    const authMethod = getAuthMethod(config.activeProvider);
    const isAuthenticated = isProviderConfigAuthenticated(config.activeProvider);
    return c.json({
      activeProvider: config.activeProvider,
      activeModel: config.activeModel,
      authMethod,
      isAuthenticated,
      hasApiKey: Boolean(active?.apiKey),
      apiKeyMasked: maskApiKey(active?.apiKey),
      accountLabel: active?.cliAccountLabel ?? null,
      actionPlanBeta: Boolean(config.actionPlanBeta),
    });
  });

  app.post('/api/config/action-plan', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { enabled?: boolean };
    const next = saveConfig({ actionPlanBeta: Boolean(body.enabled) });
    return c.json({ ok: true, actionPlanBeta: Boolean(next.actionPlanBeta) });
  });

  app.post('/api/active', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Partial<{
      activeProvider: ProviderId;
      activeModel: string;
    }>;
    const next = saveConfig({
      ...(body.activeProvider !== undefined ? { activeProvider: body.activeProvider } : {}),
      ...(body.activeModel !== undefined ? { activeModel: body.activeModel } : {}),
    });
    return c.json({ activeProvider: next.activeProvider, activeModel: next.activeModel });
  });

  // ---- Providers ----------------------------------------------------------

  app.get('/api/providers', async (c) => {
    const config = loadConfig();
    const out = listProviders().map((p) => {
      const cfg = config.providers[p.id];
      const isCustom = p.id === 'custom';
      const customCfg = config.customProvider;
      const authMethod = cfg?.authMethod ?? 'api_key';
      const isAuthenticated = isCustom
        ? Boolean(customCfg?.apiKey)
        : isProviderConfigAuthenticated(p.id);
      return {
        id: p.id,
        label: isCustom ? (customCfg?.name || 'Custom') : p.label,
        apiKeyHint: isCustom ? 'Enter your API key' : p.apiKeyHint,
        apiKeyHelpUrl: isCustom ? (customCfg?.websiteUrl || '') : p.apiKeyHelpUrl,
        supportedAuthMethods: p.supportedAuthMethods,
        authMethod,
        isAuthenticated,
        hasApiKey: isCustom ? Boolean(customCfg?.apiKey) : Boolean(cfg?.apiKey),
        apiKeyMasked: isCustom ? maskApiKey(customCfg?.apiKey) : maskApiKey(cfg?.apiKey),
        accountLabel: cfg?.cliAccountLabel ?? null,
        cliPath: cfg?.cliPath ?? null,
        cliBinaryName: p.cliBinaryName ?? null,
        models: p.listModels(),
        defaultModel: p.defaultModel(),
      };
    });
    return c.json(out);
  });

  app.post('/api/providers/:id/validate-key', async (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ ok: false, error: 'unknown_provider' }, 404);
    const body = await c.req.json().catch(() => ({})) as { apiKey?: string };
    if (!body.apiKey) return c.json({ ok: false, error: 'missing_key' }, 400);
    if (!provider.validateApiKeyFormat(body.apiKey)) {
      capture('setup_validate_key', {
        provider_id: provider.id,
        ok: false,
        error_code: 'invalid_format',
        event_source: 'server',
      });
      return c.json({ ok: false, error: 'invalid_format' }, 200);
    }
    const result = await provider.validateApiKey(body.apiKey);
    capture('setup_validate_key', {
      provider_id: provider.id,
      ok: result.ok,
      error_code: result.ok ? undefined : (result.error ?? 'unknown'),
      event_source: 'server',
    });
    return c.json(result);
  });

  app.post('/api/providers/:id/key', async (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ error: 'unknown_provider' }, 404);
    const body = await c.req.json().catch(() => ({})) as { apiKey?: string };
    if (!body.apiKey) return c.json({ error: 'missing_key' }, 400);
    if (!provider.validateApiKeyFormat(body.apiKey)) {
      return c.json({ error: 'invalid_format' }, 400);
    }
    setProviderConfig(provider.id, { apiKey: body.apiKey });
    const cfg = loadConfig();
    if (!isProviderConfigAuthenticated(cfg.activeProvider)) {
      saveConfig({ activeProvider: provider.id, activeModel: provider.defaultModel() });
    }
    capture('setup_key_saved', {
      provider_id: provider.id,
      event_source: 'server',
    });
    return c.json({ ok: true, apiKeyMasked: maskApiKey(body.apiKey) });
  });

  app.post('/api/providers/:id/auth-method', async (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ error: 'unknown_provider' }, 404);
    const body = await c.req.json().catch(() => ({})) as { authMethod?: AuthMethod };
    if (!body.authMethod || !provider.supportedAuthMethods.includes(body.authMethod)) {
      return c.json({ error: 'invalid_auth_method' }, 400);
    }
    setProviderConfig(provider.id, { authMethod: body.authMethod });
    // Authoritative analytics source for setup_auth_method_selected (browser Onboarding only calls the API).
    capture('setup_auth_method_selected', {
      provider_id: provider.id,
      auth_method: body.authMethod,
      event_source: 'server',
    });
    return c.json({ ok: true, authMethod: body.authMethod });
  });

  app.post('/api/providers/:id/validate-cli', async (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ ok: false, error: 'unknown_provider' }, 404);
    if (!provider.validateCliAccount) {
      return c.json({ ok: false, error: 'cli_account_not_supported' }, 400);
    }
    const cfg = getProviderConfig(provider.id);
    const result = await provider.validateCliAccount({ cliPath: cfg?.cliPath });
    if (result.ok && result.accountLabel) {
      setProviderConfig(provider.id, { cliAccountLabel: result.accountLabel });
    }
    capture('setup_validate_cli', {
      provider_id: provider.id,
      ok: result.ok,
      error_code: result.ok ? undefined : (result.error ?? 'unknown'),
      event_source: 'server',
    });
    return c.json(result);
  });

  app.post('/api/providers/:id/cli-path', async (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ error: 'unknown_provider' }, 404);
    const body = await c.req.json().catch(() => ({})) as { cliPath?: string };
    setProviderConfig(provider.id, { cliPath: body.cliPath?.trim() || undefined });
    capture('setup_cli_path_set', {
      provider_id: provider.id,
      has_custom_path: Boolean(body.cliPath?.trim()),
      event_source: 'server',
    });
    return c.json({ ok: true });
  });

  app.delete('/api/providers/:id/key', (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ error: 'unknown_provider' }, 404);
    setProviderConfig(provider.id, { apiKey: undefined });
    return c.json({ ok: true });
  });

  // ---- Custom Provider ----------------------------------------------------

  app.get('/api/custom-provider', (c) => {
    const cfg = getCustomProvider();
    if (!cfg) return c.json(null);
    return c.json({ ...cfg, apiKey: maskApiKey(cfg.apiKey), apiKeyPresent: Boolean(cfg.apiKey) });
  });

  app.put('/api/custom-provider', async (c) => {
    const body = (await c.req.json()) as CustomProviderConfig;
    if (!body.baseUrl || !body.apiFormat) {
      return c.json({ error: 'baseUrl and apiFormat are required' }, 400);
    }
    if (!body.models?.length) {
      return c.json({ error: 'at least one model is required' }, 400);
    }
    if (!body.defaultModel) {
      body.defaultModel = body.models[0].id;
    }
    saveCustomProvider(body);
    // Sync the custom provider key into the providers record so the rest of
    // the system (active-provider bootstrap, status endpoint, etc.) works.
    setProviderConfig('custom', { apiKey: body.apiKey, defaultModel: body.defaultModel });
    return c.json({ ok: true });
  });

  app.delete('/api/custom-provider', (c) => {
    deleteCustomProvider();
    setProviderConfig('custom', { apiKey: undefined });
    return c.json({ ok: true });
  });

  app.post('/api/custom-provider/validate', async (c) => {
    const body = (await c.req.json()) as Partial<CustomProviderConfig>;
    if (!body.baseUrl || !body.apiKey || !body.apiFormat) {
      return c.json({ ok: false, error: 'baseUrl, apiKey, and apiFormat are required' }, 400);
    }
    try {
      const url =
        body.apiFormat === 'anthropic'
          ? `${body.baseUrl.replace(/\/+$/, '')}/v1/models?limit=1`
          : `${body.baseUrl.replace(/\/+$/, '')}/models`;
      const headers: Record<string, string> =
        body.apiFormat === 'anthropic'
          ? { 'x-api-key': body.apiKey, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${body.apiKey}` };
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return c.json({ ok: false, error: text });
      }
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ ok: false, error: (err as Error).message });
    }
  });

  // ---- Chats CRUD ---------------------------------------------------------

  app.get('/api/chats', (c) => {
    return c.json(listChats());
  });

  app.post('/api/chats', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Partial<{
      provider: ProviderId;
      model: string;
      title: string;
    }>;
    const config = loadConfig();
    const providerId = body.provider ?? config.activeProvider;
    const provider = getProvider(providerId);
    if (!provider) return c.json({ error: 'unknown_provider' }, 400);
    const model = body.model ?? config.activeModel ?? provider.defaultModel();
    const chat = createChat({ provider: providerId, model, title: body.title });
    identifyUiModelSelection(providerId, model);
    return c.json(chat);
  });

  app.get('/api/chats/:id', (c) => {
    const chat = getChat(c.req.param('id'));
    if (!chat) return c.json({ error: 'not_found' }, 404);
    const messages = getMessages(chat.id);
    return c.json({ chat, messages });
  });

  app.patch('/api/chats/:id', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Partial<{
      title: string;
      provider: ProviderId;
      model: string;
    }>;
    const id = c.req.param('id');
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) return c.json({ error: 'invalid_title' }, 400);
      renameChat(id, t);
    }
    if (body.provider !== undefined || body.model !== undefined) {
      const chat = getChat(id);
      if (!chat) return c.json({ error: 'not_found' }, 404);
      const provider = body.provider ?? (chat.provider as ProviderId);
      const adapter = getProvider(provider);
      if (!adapter) return c.json({ error: 'unknown_provider' }, 400);
      const model = body.model ?? (body.provider ? adapter.defaultModel() : chat.model);
      updateChatModel(id, provider, model);
      identifyUiModelSelection(provider, model);
    }
    return c.json({ ok: true });
  });

  app.delete('/api/chats/:id', (c) => {
    deleteChat(c.req.param('id'));
    return c.json({ ok: true });
  });

  // ---- Chat streaming -----------------------------------------------------

  app.post('/api/chat', async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      chatId?: string;
      prompt?: string;
      requestId?: string;
    };
    if (!body.prompt || !body.chatId) {
      return c.json({ error: 'missing_chat_or_prompt' }, 400);
    }

    const chat = getChat(body.chatId);
    if (!chat) return c.json({ error: 'chat_not_found' }, 404);

    const provider = getProvider(chat.provider);
    if (!provider) return c.json({ error: 'unknown_provider' }, 400);

    const config = loadConfig();
    const providerCfg = config.providers[chat.provider as ProviderId];
    const authMethod = providerCfg?.authMethod ?? 'api_key';

    if (authMethod === 'api_key') {
      if (!providerCfg?.apiKey) return c.json({ error: 'no_api_key' }, 400);
    } else if (provider.validateCliAccount) {
      const check = await provider.validateCliAccount({ cliPath: providerCfg?.cliPath });
      if (!check.ok) {
        return c.json({ error: 'cli_not_authenticated', detail: check.error }, 400);
      }
      if (check.accountLabel) {
        setProviderConfig(provider.id, { cliAccountLabel: check.accountLabel });
      }
    } else {
      return c.json({ error: 'cli_account_not_supported' }, 400);
    }

    // Persist the user message first; auto-title the chat if it's still default.
    appendMessage({
      chatId: chat.id,
      role: 'user',
      content: { text: body.prompt, toolCalls: [] },
    });
    if (chat.title === 'New chat') {
      const title = body.prompt.trim().slice(0, 50) || 'New chat';
      renameChat(chat.id, title);
    }

    const history = buildHistory(getMessages(chat.id).slice(0, -1));

    const requestId = body.requestId ?? crypto.randomUUID();
    const controller = new AbortController();
    abortControllers.set(requestId, controller);

    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let buffer: AssistantBuffer = { text: '', toolCalls: [] };
      let lastFinish: RunChatFinishInfo | null = null;
      let assistantPersisted = false;

      const persistAssistant = () => {
        if (assistantPersisted) return;
        if (
          !buffer.text &&
          !buffer.reasoning &&
          buffer.toolCalls.length === 0 &&
          !buffer.plan
        ) {
          return;
        }
        appendMessage({
          chatId: chat.id,
          role: 'assistant',
          content: {
            text: buffer.text,
            toolCalls: buffer.toolCalls,
            provider: chat.provider,
            model: chat.model,
            ...(buffer.reasoning ? { reasoning: buffer.reasoning } : {}),
            ...(buffer.plan ? { plan: buffer.plan } : {}),
            ...(lastFinish?.usage ? { usage: lastFinish.usage } : {}),
            ...(lastFinish?.cost ? { cost: lastFinish.cost } : {}),
          },
        });
        assistantPersisted = true;
      };

      const logBetaTurn = (): void => {
        if (!assistantPersisted) return;
        captureBetaChatTurn({
          providerId: chat.provider,
          model: chat.model,
          authMethod,
          userPrompt: body.prompt!,
          assistantText: buffer.text,
          assistantReasoning: buffer.reasoning,
          toolNames: buffer.toolCalls.map((toolCall) => toolCall.name),
        });
      };

      await stream.writeSSE({ event: 'start', data: JSON.stringify({ requestId }) });
      try {
        const iterator = runChat({
          prompt: body.prompt!,
          history,
          provider,
          authMethod,
          apiKey: providerCfg?.apiKey,
          cliPath: providerCfg?.cliPath,
          modelId: chat.model,
          chatId: chat.id,
          abortSignal: controller.signal,
          onAssistantBuffer: (b) => {
            buffer = b;
          },
          onFinish: (info) => {
            lastFinish = info;
          },
        });

        for await (const ev of iterator) {
          if (controller.signal.aborted) break;
          await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev.payload) });
        }

        persistAssistant();
        logBetaTurn();
        await stream.writeSSE({ event: 'done', data: '{}' });
      } catch (err) {
        logger.error('chat error', err);
        persistAssistant();
        logBetaTurn();
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: (err as Error).message }),
        });
      } finally {
        abortControllers.delete(requestId);
      }
    });
  });

  app.post('/api/abort/:id', (c) => {
    const id = c.req.param('id');
    const controller = abortControllers.get(id);
    if (!controller) return c.json({ ok: false, error: 'not_found' }, 404);
    controller.abort();
    abortControllers.delete(id);
    return c.json({ ok: true });
  });

  // ---- Static UI ----------------------------------------------------------

  // Files emitted by Vite under /assets carry content hashes in their names,
  // so they're safe to cache forever. Everything else (index.html, bare svg
  // favicon, etc.) must revalidate on each load.
  const cacheControlFor = (pathname: string): string =>
    pathname.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

  // The shell carries the session token, so it must never be stored on disk by
  // the browser or an intermediary.
  const renderIndexHtml = async (): Promise<Response> => {
    const html = await readFile(join(WEB_DIST, 'index.html'), 'utf8');
    return new Response(injectSessionToken(html, token), {
      headers: {
        'content-type': MIME['.html']!,
        'cache-control': 'no-store',
      },
    });
  };

  app.get('*', async (c) => {
    const url = new URL(c.req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const safe = normalize(pathname).replace(/^[/\\]+/, '');
    const filePath = join(WEB_DIST, safe);
    if (!filePath.startsWith(WEB_DIST)) {
      return c.text('forbidden', 403);
    }
    try {
      const stats = await stat(filePath);
      if (stats.isFile()) {
        if (safe === 'index.html') return await renderIndexHtml();
        const buf = await readFile(filePath);
        const ext = '.' + safe.split('.').pop();
        return new Response(new Uint8Array(buf), {
          headers: {
            'content-type': MIME[ext] ?? 'application/octet-stream',
            'cache-control': cacheControlFor(safe),
          },
        });
      }
    } catch {
      // fall through to SPA fallback
    }
    try {
      return await renderIndexHtml();
    } catch {
      return c.text(
        'UI bundle not found. Run `npm run build` and try again.',
        500
      );
    }
  });

  const server: ServerType = serve(
    { fetch: app.fetch, port: opts.port, hostname: opts.host },
    (info) => logger.info(`Listening on http://${opts.host}:${info.port}`)
  );

  return {
    url: `http://${opts.host}:${opts.port}`,
    token,
    close: () =>
      new Promise<void>((resolveClose) => {
        for (const controller of abortControllers.values()) controller.abort();
        abortControllers.clear();
        removeSessionFile();
        server.close(() => resolveClose());
      }),
  };
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
/** Binds that accept any interface, so no single expected hostname exists. */
const WILDCARD_HOSTS = new Set(['', '0.0.0.0', '::', '[::]']);

interface ParsedHost {
  hostname: string;
  port: string;
}

function parseHostHeader(host: string | undefined): ParsedHost | null {
  if (!host) return null;
  try {
    const u = new URL(`http://${host}`);
    if (!u.hostname) return null;
    return { hostname: u.hostname, port: u.port };
  } catch {
    return null;
  }
}

function isAllowedHost(host: ParsedHost, opts: UIServerOptions): boolean {
  if (host.port !== '' && host.port !== String(opts.port)) return false;
  if (WILDCARD_HOSTS.has(opts.host)) return true;
  return LOOPBACK_HOSTNAMES.has(host.hostname) || host.hostname === opts.host;
}

function isAllowedOrigin(origin: string, hostHostname: string, port: number): boolean {
  try {
    const u = new URL(origin);
    if (u.port !== '' && u.port !== String(port)) return false;
    if (u.hostname === hostHostname) return true;
    // localhost and 127.0.0.1 address the same server, and browsers pick either
    // depending on how the user reached the UI.
    return LOOPBACK_HOSTNAMES.has(u.hostname) && LOOPBACK_HOSTNAMES.has(hostHostname);
  } catch {
    return false;
  }
}

function injectSessionToken(html: string, token: string): string {
  const literal = JSON.stringify(token).replace(/</g, '\\u003c');
  const tag = `<script>window.__PSMCP_TOKEN__=${literal};</script>`;
  const head = /<head[^>]*>/i.exec(html);
  if (!head) return tag + html;
  const at = head.index + head[0].length;
  return html.slice(0, at) + tag + html.slice(at);
}
