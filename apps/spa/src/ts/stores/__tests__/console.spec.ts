import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConsoleStore } from '../console';

describe('console store', () => {
  let store: ReturnType<typeof useConsoleStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    store = useConsoleStore();
  });

  describe('addLog', () => {
    it('adds log entry with auto-incremented id and timestamp', () => {
      store.addLog('First log', 'info');
      expect(store.consoleLogs).toHaveLength(1);
      expect(store.consoleLogs[0].text).toBe('First log');
      expect(store.consoleLogs[0].type).toBe('info');
      expect(store.consoleLogs[0].id).toBe(1);

      store.addLog('Second log', 'error');
      expect(store.consoleLogs).toHaveLength(2);
      expect(store.consoleLogs[0].text).toBe('Second log');
      expect(store.consoleLogs[0].id).toBe(2);
    });

    it('caps log count at 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        store.addLog(`Log ${i}`);
      }
      expect(store.consoleLogs).toHaveLength(100);
    });
  });

  describe('addToast & getToastIcon', () => {
    it('adds toast and auto-removes it after 3000ms', () => {
      store.addToast('Saved successfully!', 'success');
      expect(store.toasts).toHaveLength(1);
      expect(store.toasts[0].text).toBe('Saved successfully!');
      expect(store.toasts[0].type).toBe('success');

      vi.advanceTimersByTime(3001);
      expect(store.toasts).toHaveLength(0);
    });

    it('returns appropriate icon class for each toast type', () => {
      expect(store.getToastIcon('success')).toBe('fas fa-check-circle');
      expect(store.getToastIcon('warn')).toBe('fas fa-exclamation-triangle');
      expect(store.getToastIcon('error')).toBe('fas fa-times-circle');
      expect(store.getToastIcon('info')).toBe('fas fa-info-circle');
    });
  });
});
