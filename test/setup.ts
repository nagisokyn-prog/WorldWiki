
// Import all Tauri and DOM mocks
import './mocks/tauri';

// Re-export test utilities for convenience
export { mockTauriResponse, mockTauriError, waitForNextTick, flushPromises, mockInvoke, mockListen, mockEmit } from './mocks/tauri';