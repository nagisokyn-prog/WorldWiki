/**
 * @file tauri.d.ts
 * @description Типы для Tauri API
 * @rust-ready ✅ Все invoke вызовы могут быть перенесены на Rust
 */

// Tauri Core API
interface TauriCore {
  /**
   * Вызывает Rust команду
   * @rust-ready ✅
   */
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

// Tauri Event API
interface TauriEvent {
  listen<T>(event: string, handler: (payload: { payload: T }) => void): Promise<() => void>;
  emit(event: string, payload?: unknown): Promise<void>;
}

// Tauri Window API
interface TauriWindow {
  getCurrent(): {
    label: string;
    close(): Promise<void>;
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
    isMaximized(): Promise<boolean>;
    isMinimized(): Promise<boolean>;
  };
}

// Tauri Path API
interface TauriPath {
  appDataDir(): Promise<string>;
  appCacheDir(): Promise<string>;
  resolve(...paths: string[]): Promise<string>;
}

// Tauri FS API
interface TauriFS {
  readTextFile(path: string, options?: { dir?: number }): Promise<string>;
  writeTextFile(path: string, contents: string, options?: { dir?: number }): Promise<void>;
  exists(path: string, options?: { dir?: number }): Promise<boolean>;
  createDir(path: string, options?: { dir?: number; recursive?: boolean }): Promise<void>;
  removeDir(path: string, options?: { dir?: number; recursive?: boolean }): Promise<void>;
}

// Tauri Dialog API
interface TauriDialog {
  open(options?: {
    multiple?: boolean;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | string[] | null>;
  save(options?: {
    filters?: { name: string; extensions: string[] }[];
    defaultPath?: string;
  }): Promise<string | null>;
}

// Tauri Shell API
interface TauriShell {
  open(path: string): Promise<void>;
}

// Tauri Global Object
interface TauriAPI {
  core: TauriCore;
  event: TauriEvent;
  window: TauriWindow;
  path: TauriPath;
  fs: TauriFS;
  dialog: TauriDialog;
  shell: TauriShell;
}

// Window interface
interface Window {
  __TAURI__: TauriAPI;
}

// Tauri Base Directory enum
declare const enum BaseDirectory {
  AppData = 1,
  AppCache = 2,
  AppLocalData = 3,
  AppLog = 4,
  Document = 5,
  Picture = 6,
  Music = 7,
  Video = 8,
  Download = 9,
  Desktop = 10,
  Home = 11,
}