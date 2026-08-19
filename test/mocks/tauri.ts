/// <reference types="vitest/globals" />
import { vi } from 'vitest';

// ============================================================================
// Tauri API Mocks
// ============================================================================

// Mock invoke function with typed responses
export const mockInvoke = vi.fn();

// Mock listen/unlisten for events
const mockListeners = new Map<string, Set<(...args: any[]) => any>>();

export const mockListen = vi.fn(async (eventName: string, callback: (...args: any[]) => any) => {
  if (!mockListeners.has(eventName)) {
    mockListeners.set(eventName, new Set());
  }
  mockListeners.get(eventName)!.add(callback);
  
  // Return unlisten function
  return vi.fn(() => {
    mockListeners.get(eventName)?.delete(callback);
  });
});

export const mockEmit = vi.fn((eventName: string, payload: any) => {
  const listeners = mockListeners.get(eventName);
  if (listeners) {
    listeners.forEach(cb => cb({ payload }));
  }
});

export const mockUnlisten = vi.fn();

export const mockTransformCallback = vi.fn((_cb: any, _once?: boolean) => 1);
export const mockConvertFileSrc = vi.fn((path: string) => path);

// Mock Tauri global
const tauriMock = {
  core: {
    invoke: mockInvoke,
    transformCallback: mockTransformCallback,
    convertFileSrc: mockConvertFileSrc,
  },
  event: {
    listen: mockListen,
    emit: mockEmit,
  },
};

// Stub global __TAURI__
vi.stubGlobal('__TAURI__', tauriMock);

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
  transformCallback: mockTransformCallback,
  convertFileSrc: mockConvertFileSrc,
}));

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  emit: mockEmit,
  UnlistenFn: vi.fn(),
}));

// Mock @tauri-apps/api/window
vi.mock('@tauri-apps/api/window', () => ({
  WebviewWindow: vi.fn().mockImplementation(() => ({
    onCloseRequested: vi.fn(),
    close: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    setTitle: vi.fn(),
    setSize: vi.fn(),
    setPosition: vi.fn(),
    center: vi.fn(),
    maximize: vi.fn(),
    minimize: vi.fn(),
    unmaximize: vi.fn(),
    setFullscreen: vi.fn(),
    setResizable: vi.fn(),
    setDecorations: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setFocus: vi.fn(),
    setIcon: vi.fn(),
    setSkipTaskbar: vi.fn(),
    setCursorGrab: vi.fn(),
    setCursorVisible: vi.fn(),
    setCursorIcon: vi.fn(),
    startDragging: vi.fn(),
    listen: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  })),
  getCurrentWebviewWindow: vi.fn(() => ({
    onCloseRequested: vi.fn(),
    close: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    setTitle: vi.fn(),
    label: 'main',
  })),
  getAllWebviewWindows: vi.fn(() => []),
}));

// Mock @tauri-apps/api/dialog
vi.mock('@tauri-apps/api/dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  message: vi.fn(),
  ask: vi.fn(),
  confirm: vi.fn(),
}));

// Mock @tauri-apps/api/fs
vi.mock('@tauri-apps/api/fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  readDir: vi.fn(),
  createDir: vi.fn(),
  removeDir: vi.fn(),
  removeFile: vi.fn(),
  renameFile: vi.fn(),
  copyFile: vi.fn(),
  exists: vi.fn(),
  BaseDirectory: {
    AppData: 'app-data',
    AppLocalData: 'app-local-data',
    AppConfig: 'app-config',
    AppCache: 'app-cache',
    AppLog: 'app-log',
    Audio: 'audio',
    Desktop: 'desktop',
    Document: 'document',
    Download: 'download',
    Font: 'font',
    Home: 'home',
    Picture: 'picture',
    Public: 'public',
    Template: 'template',
    Video: 'video',
    Resource: 'resource',
    Temp: 'temp',
    Executable: 'executable',
  },
}));

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute: { value: { params: {}, query: {} } },
  }),
  useRoute: () => ({
    params: {},
    query: {},
    path: '/',
  }),
}));

// ============================================================================
// DOM & Browser Mocks
// ============================================================================

// Mock window.matchMedia
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
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock IntersectionObserver
global.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  writable: true,
  value: localStorageMock,
});

// Mock document.dispatchEvent
const originalDispatchEvent = document.dispatchEvent.bind(document);
document.dispatchEvent = vi.fn((event: Event) => {
  originalDispatchEvent(event);
  return true;
});

// Mock performance.now
if (!global.performance) {
  global.performance = { now: vi.fn(() => Date.now()) } as any;
} else {
  global.performance.now = vi.fn(() => Date.now());
}

// Mock crypto.randomUUID
if (!global.crypto) {
  global.crypto = {} as any;
}
global.crypto.randomUUID = vi.fn(() => `test-uuid-${Math.random().toString(36).substr(2, 9)}`) as any;

// Mock URL.createObjectURL / revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// ============================================================================
// Test Utilities
// ============================================================================

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockListeners.clear();
  localStorageMock.clear();
  
  // Reset Tauri invoke mock to default resolved promise
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue(undefined);
});

// Helper to create a mock Tauri invoke response
export function mockTauriResponse<T>(data: T): void {
  mockInvoke.mockResolvedValueOnce(data);
}

// Helper to create a mock Tauri invoke error
export function mockTauriError(error: Error | string): void {
  mockInvoke.mockRejectedValueOnce(typeof error === 'string' ? new Error(error) : error);
}

// Helper to wait for next tick
export function waitForNextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Helper to flush promises
export function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}