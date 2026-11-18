import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import Splash from './Splash.vue.ts';

const mockPush = vi.fn();
const mockInvoke = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args)
}));

describe('Splash.vue.ts', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
  });

  function mountSplash() {
    return mount({
      ...Splash,
      render() {
        const proxy = this as unknown as Record<string, unknown>;
        return h('div', [
          h('div', { id: 'progressBar', ref: (el) => { proxy.progressBarRef = el; } }),
          h('div', { id: 'statusText', ref: (el) => { proxy.statusTextRef = el; } }),
          h('div', { id: 'perfBadge', ref: (el) => { proxy.perfBadgeRef = el; } }),
          h('div', { id: 'perfDetails', ref: (el) => { proxy.perfDetailsRef = el; } }),
          h('pre', { id: 'asciiArt', ref: (el) => { proxy.asciiArtRef = el; } })
        ]);
      }
    });
  }

  it('runs startup sequence, saves benchmark metrics, and navigates to /launcher', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'run_performance_benchmark') {
        return { cpu_score: 12, memory_mb: 8, cores: 8, level: 'high' };
      }
      return undefined;
    });

    wrapper = mountSplash();

    await vi.advanceTimersByTimeAsync(1500);

    expect(mockInvoke).toHaveBeenCalledWith('run_performance_benchmark');
    expect(localStorage.getItem('perfLevel')).toBe('high');
    expect(localStorage.getItem('perfCpuScore')).toBe('12');
    expect(localStorage.getItem('perfMemoryMb')).toBe('8');
    expect(localStorage.getItem('perfCores')).toBe('8');
    expect(mockPush).toHaveBeenCalledWith('/launcher');
  });

  it('handles startup error gracefully and still navigates to /launcher', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockInvoke.mockRejectedValueOnce(new Error('DB init failed'));

    wrapper = mountSplash();

    await vi.advanceTimersByTimeAsync(2600);

    expect(mockPush).toHaveBeenCalledWith('/launcher');

    errSpy.mockRestore();
  });

  it('toggles fullscreen on F11 and removes keydown listener on unmount', () => {
    mockInvoke.mockResolvedValue(undefined);
    wrapper = mountSplash();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F11' }));
    expect(mockInvoke).toHaveBeenCalledWith('toggle_fullscreen');

    mockInvoke.mockClear();
    wrapper.unmount();
    wrapper = null;

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F11' }));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('handles missing perf fields, unknown level, non-Error rejection, and non-F11 key', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockInvoke.mockResolvedValueOnce({ level: 'unknown_level' });

    wrapper = mountSplash();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    expect(mockInvoke).not.toHaveBeenCalledWith('toggle_fullscreen');

    await vi.advanceTimersByTimeAsync(1500);
    expect(localStorage.getItem('perfLevel')).toBe('unknown_level');
    expect(mockPush).toHaveBeenCalledWith('/launcher');

    wrapper.unmount();
    wrapper = null;
    mockPush.mockClear();

    mockInvoke.mockRejectedValueOnce('plain string error');
    wrapper = mountSplash();
    await vi.advanceTimersByTimeAsync(2600);
    expect(mockPush).toHaveBeenCalledWith('/launcher');

    errSpy.mockRestore();
  });
});
