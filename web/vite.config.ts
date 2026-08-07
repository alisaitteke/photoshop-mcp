import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const SESSION_TOKEN_HEADER = 'x-psmcp-token';

// In dev the UI is served by Vite, so it never receives the token the API
// server injects into its own index.html. The proxy supplies it instead,
// reading the session file the server writes on startup.
function sessionFilePath(): string {
  const home = process.env.PHOTOSHOP_MCP_HOME?.trim() || join(homedir(), '.photoshop-mcp');
  return join(home, 'ui-session.json');
}

let cachedSession: { mtimeMs: number; token: string } | null = null;

function readSessionToken(): string | undefined {
  const override = process.env.PSMCP_UI_TOKEN?.trim();
  if (override) return override;
  try {
    const path = sessionFilePath();
    const { mtimeMs } = statSync(path);
    if (cachedSession?.mtimeMs !== mtimeMs) {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { token?: string };
      if (!parsed.token) return undefined;
      cachedSession = { mtimeMs, token: parsed.token };
    }
    return cachedSession?.token;
  } catch {
    return undefined;
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5174',
        changeOrigin: true,
        configure: (proxy) => {
          // Rewrite Origin so Hono's loopback-origin guard accepts proxied requests in dev.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://127.0.0.1:5174');
            const token = readSessionToken();
            if (token) proxyReq.setHeader(SESSION_TOKEN_HEADER, token);
          });
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no';
            proxyRes.headers['cache-control'] = 'no-cache';
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
