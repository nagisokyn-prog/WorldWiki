import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useTiptapKeyboard, type UseTiptapKeyboardOptions } from './useTiptapKeyboard';
import type { AppSettings } from '@worldwiki/components';

let settingsChangeCallback: ((s: AppSettings) => void) | null = null;

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    onChange: (cb: (s: AppSettings) => void) => {
      settingsChangeCallback = cb;
    }
  }
}));

describe('useTiptapKeyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    settingsChangeCallback = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mountKeyboard(overrides: Partial<UseTiptapKeyboardOptions> = {}) {
    const options: UseTiptapKeyboardOptions = {
      ctrlPressed: ref(false),
      settings: ref({ editor: { autoSaveInterval: 5 } } as AppSettings),
      hasUnsavedChanges: vi.fn(() => true),
      onSave: vi.fn(),
      onRestorePosition: vi.fn(),
      onSavePosition: vi.fn(),
      onBeforeUnload: vi.fn(),
      onToggleStructure: vi.fn(),
      ...overrides
    };

    const Comp = defineComponent({
      setup() {
        useTiptapKeyboard(options);
        return () => h('div');
      }
    });

    const wrapper = mount(Comp);
    return { wrapper, options };
  }

  it('starts autosave timer, restores position, reacts to settings changes, and cleans up on unmount', () => {
    const { wrapper, options } = mountKeyboard();

    vi.advanceTimersByTime(100);
    expect(options.onRestorePosition).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(options.onSave).toHaveBeenCalledTimes(1);

    // Settings update restarts autosave timer with new interval
    settingsChangeCallback?.({ editor: { autoSaveInterval: 2 } } as AppSettings);
    (options.onSave as ReturnType<typeof vi.fn>).mockClear();
    vi.advanceTimersByTime(2000);
    expect(options.onSave).toHaveBeenCalledTimes(1);

    // Unmount clears interval and removes listeners
    wrapper.unmount();
    (options.onSave as ReturnType<typeof vi.fn>).mockClear();
    vi.advanceTimersByTime(5000);
    expect(options.onSave).not.toHaveBeenCalled();
  });

  it('handles Control/Meta key state, blur, Ctrl+S, Ctrl+Alt+B, F5/Ctrl+R, and structure events', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      configurable: true
    });

    const { wrapper, options } = mountKeyboard();

    // Control keydown / keyup / blur
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    expect(options.ctrlPressed.value).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
    expect(options.ctrlPressed.value).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta' }));
    expect(options.ctrlPressed.value).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(options.ctrlPressed.value).toBe(false);

    // Ctrl+Alt+B toggles right panel
    const panelEvents: CustomEvent[] = [];
    const onPanel = (e: Event) => panelEvents.push(e as CustomEvent);
    document.addEventListener('ww:toggle-right-panel', onPanel);
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, code: 'KeyB' }));
    expect(localStorage.getItem('chapters-right-panel-visible')).toBe('true');
    expect(panelEvents[0].detail).toEqual({ visible: true });
    document.removeEventListener('ww:toggle-right-panel', onPanel);

    // Ctrl+S saves
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 's' }));
    expect(options.onSave).toHaveBeenCalledTimes(1);

    // Ctrl+к toggles structure (Russian layout)
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'к' }));
    expect(options.onToggleStructure).toHaveBeenCalledTimes(1);

    // Custom structure events
    document.dispatchEvent(new CustomEvent('ww:toggle-split-structure'));
    document.dispatchEvent(new CustomEvent('ww:toggle-structure'));
    expect(options.onToggleStructure).toHaveBeenCalledTimes(3);

    // F5 saves position & chapter then reloads
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
    expect(options.onSavePosition).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
