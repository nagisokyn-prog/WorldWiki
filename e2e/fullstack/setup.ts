import { vi } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

// Path to the compiled Rust cdylib / N-API node addon
const addonCandidates = [
  resolve(__dirname, '../prebuilt/worldwiki_e2e.node'),
  resolve(__dirname, '../prebuilt/worldwiki_e2e.dll'),
  resolve(__dirname, '../target/debug/worldwiki_e2e.node'),
  resolve(__dirname, '../target/debug/worldwiki_e2e.dll'),
  resolve(__dirname, '../../target/debug/worldwiki_e2e.node'),
  resolve(__dirname, '../../target/debug/worldwiki_e2e.dll'),
];

let tauriBackend: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } | null = null;

for (const candidate of addonCandidates) {
  if (existsSync(candidate)) {
    try {
      tauriBackend = require(candidate);
      break;
    } catch (err) {
      console.error(`[Setup] Failed to load candidate ${candidate}:`, err);
    }
  }
}

const invokeFn = async (cmd: string, args?: Record<string, unknown>) => {
  if (tauriBackend && typeof tauriBackend.invoke === 'function') {
    return await tauriBackend.invoke(cmd, args ?? {});
  }
  // Fallback error if the native addon has not been compiled yet
  throw new Error(
    `[Headless E2E] Native addon not found. Run 'pnpm build:test-addon' before running e2e tests. Attempted command: ${cmd}`
  );
};

// Mock @tauri-apps/api/core to route invoke() calls to Rust
vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeFn,
}));

// Browser API polyfills for JSDOM
if (typeof window !== 'undefined') {
  const internals = {
    invoke: invokeFn,
    transformCallback: () => 0,
  };
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = internals;
  (window as unknown as Record<string, unknown>).__TAURI__ = {
    core: {
      invoke: invokeFn,
    },
  };
  (window as unknown as Record<string, unknown>).__TSK_INVOKE__ = invokeFn;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}
