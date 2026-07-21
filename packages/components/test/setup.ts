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

// Mock window functions
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

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock
});

// Mock document.documentElement.style.setProperty
Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: {
    style: {
      setProperty: vi.fn(),
      getPropertyValue: vi.fn()
    }
  }
});

// Mock document.body
Object.defineProperty(document, 'body', {
  writable: true,
  value: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn()
    },
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    getElementById: vi.fn()
  }
});

// Mock document.createElement
const originalCreateElement = document.createElement.bind(document);
document.createElement = vi.fn((tagName: string) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'div' || tagName === 'img' || tagName === 'video') {
    element.style = {};
    element.appendChild = vi.fn();
    element.setAttribute = vi.fn();
    element.getAttribute = vi.fn();
  }
  return element;
});

// Mock getElementById
const mockGetElementById = vi.fn((id: string) => {
  if (id === 'ww-background') {
    const element = document.createElement('div');
    element.id = 'ww-background';
    element.style.cssText = '';
    element.innerHTML = '';
    element.appendChild = vi.fn();
    return element;
  }
  return null;
});
Object.defineProperty(document, 'getElementById', {
  writable: true,
  value: mockGetElementById
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as typeof console;
