/// <reference types="vite/client" />

declare module 'uno.css' {
  const css: string;
  export default css;
}

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    __APP_CONFIG__: {
      id: string;
      name: string;
      storageKey: string;
    };
  }
}