// Import all Tauri and DOM mocks
import './mocks/tauri';

if (typeof window !== 'undefined') {
  if (!window.print) {
    window.print = () => {};
  }
  window.open = () => null;
  if (typeof navigator !== 'undefined') {
    let clipboardText = '';
    const clipboardMock = {
      writeText: async (text: string) => { clipboardText = text; },
      readText: async () => clipboardText,
    };
    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: clipboardMock,
        writable: true,
        configurable: true,
      });
    } catch {
      // Ignore if cannot redefine
    }
  }
}

// Re-export test utilities for convenience
export { mockTauriResponse, mockTauriError, waitForNextTick, flushPromises, mockInvoke, mockListen, mockEmit } from './mocks/tauri';
