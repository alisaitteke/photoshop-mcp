/// <reference types="vite/client" />

interface Window {
  /** Session token for `/api/*`, injected into index.html by the UI server. */
  __PSMCP_TOKEN__?: string;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
