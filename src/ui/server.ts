import { serve, type ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '../utils/logger.js';
import {
  buildHistory,
  runChat,
  type AssistantBuffer,
  type RunChatFinishInfo,
} from './agent.js';
import {
  getAuthMethod,
  getProviderConfig,
  isProviderConfigAuthenticated,
  loadConfig,
  maskApiKey,
  probeProviderAuthentication,
  saveConfig,
  setProviderConfig,
  type AuthMethod,
  type ProviderId,
} from './config.js';
import { getProvider, listProviders } from './providers/registry.js';
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
}

export interface UIServer {
  url: string;
  close(): Promise<void>;
}

export async function startUIServer(opts: UIServerOptions): Promise<UIServer> {
  const logger = new Logger('UIServer');
  const app = new Hono();

  // Initialize the SQLite database eagerly so the first request is fast and
  // any migration error surfaces during startup instead of mid-request.
  getDB();

  const abortControllers = new Map<string, AbortController>();

  app.use('/api/*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && !isLoopbackOrigin(origin, opts.port)) {
      return c.json({ error: 'invalid_origin' }, 403);
    }
    return next();
  });

  // ---- Status -------------------------------------------------------------

  app.get('/api/status', async (c) => {
    const config = loadConfig();
    const active = config.providers[config.activeProvider];
    const authMethod = getAuthMethod(config.activeProvider);
    const isAuthenticated = await probeProviderAuthentication(config.activeProvider);
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
    const out = await Promise.all(
      listProviders().map(async (p) => {
        const cfg = config.providers[p.id];
        const authMethod = cfg?.authMethod ?? 'api_key';
        const isAuthenticated = await probeProviderAuthentication(p.id);
        return {
          id: p.id,
          label: p.label,
          apiKeyHint: p.apiKeyHint,
          apiKeyHelpUrl: p.apiKeyHelpUrl,
          supportedAuthMethods: p.supportedAuthMethods,
          authMethod,
          isAuthenticated,
          hasApiKey: Boolean(cfg?.apiKey),
          apiKeyMasked: maskApiKey(cfg?.apiKey),
          accountLabel: cfg?.cliAccountLabel ?? null,
          cliPath: cfg?.cliPath ?? null,
          models: p.listModels(),
          defaultModel: p.defaultModel(),
        };
      })
    );
    return c.json(out);
  });

  app.post('/api/providers/:id/validate-key', async (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ ok: false, error: 'unknown_provider' }, 404);
    const body = await c.req.json().catch(() => ({})) as { apiKey?: string };
    if (!body.apiKey) return c.json({ ok: false, error: 'missing_key' }, 400);
    if (!provider.validateApiKeyFormat(body.apiKey)) {
      return c.json({ ok: false, error: 'invalid_format' }, 200);
    }
    const result = await provider.validateApiKey(body.apiKey);
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
    return c.json(result);
  });

  app.post('/api/providers/:id/cli-path', async (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ error: 'unknown_provider' }, 404);
    const body = await c.req.json().catch(() => ({})) as { cliPath?: string };
    setProviderConfig(provider.id, { cliPath: body.cliPath?.trim() || undefined });
    return c.json({ ok: true });
  });

  app.delete('/api/providers/:id/key', (c) => {
    const provider = getProvider(c.req.param('id'));
    if (!provider) return c.json({ error: 'unknown_provider' }, 404);
    setProviderConfig(provider.id, { apiKey: undefined });
    return c.json({ ok: true });
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

    return streamSSE(c, async (stream) => {
      let buffer: AssistantBuffer = { text: '', toolCalls: [] };
      let lastFinish: RunChatFinishInfo | null = null;
      let assistantPersisted = false;

      const persistAssistant = () => {
        if (assistantPersisted) return;
        if (!buffer.text && buffer.toolCalls.length === 0 && !buffer.plan) return;
        appendMessage({
          chatId: chat.id,
          role: 'assistant',
          content: {
            text: buffer.text,
            toolCalls: buffer.toolCalls,
            provider: chat.provider,
            model: chat.model,
            ...(buffer.plan ? { plan: buffer.plan } : {}),
            ...(lastFinish?.usage ? { usage: lastFinish.usage } : {}),
            ...(lastFinish?.cost ? { cost: lastFinish.cost } : {}),
          },
        });
        assistantPersisted = true;
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
        await stream.writeSSE({ event: 'done', data: '{}' });
      } catch (err) {
        logger.error('chat error', err);
        persistAssistant();
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
      const buf = await readFile(join(WEB_DIST, 'index.html'));
      return new Response(buf.toString('utf8'), {
        headers: {
          'content-type': MIME['.html']!,
          'cache-control': 'no-cache',
        },
      });
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
    close: () =>
      new Promise<void>((resolveClose) => {
        for (const controller of abortControllers.values()) controller.abort();
        abortControllers.clear();
        server.close(() => resolveClose());
      }),
  };
}

function isLoopbackOrigin(origin: string, port: number): boolean {
  try {
    const u = new URL(origin);
    const isLoopback =
      u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
    return isLoopback && (u.port === '' || u.port === String(port));
  } catch {
    return false;
  }
}
