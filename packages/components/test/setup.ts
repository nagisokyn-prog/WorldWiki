import { vi } from 'vitest';

// Mock Tauri API
vi.stubGlobal('__TAURI__', {
  core: {
    invoke: vi.fn(),
    convertFileSrc: vi.fn((path) => path)
  },
  fs: {
    readFile: vi.fn()
  }
});

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});
