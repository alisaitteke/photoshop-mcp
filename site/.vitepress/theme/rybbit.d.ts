interface Rybbit {
  pageview: () => void;
  event: (name: string, properties?: Record<string, string | number | boolean>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  setTraits: (traits: Record<string, unknown>) => void;
  onReady: (callback: (rybbit: Rybbit) => void) => void;
}

declare global {
  interface Window {
    rybbit?: Rybbit;
    __RYBBIT_OPTOUT__?: boolean;
  }
}

export {};
