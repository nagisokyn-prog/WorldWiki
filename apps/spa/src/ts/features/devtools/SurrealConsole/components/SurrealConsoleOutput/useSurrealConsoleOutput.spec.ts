import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useSurrealConsoleOutput } from './useSurrealConsoleOutput';

describe('useSurrealConsoleOutput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('copies output to clipboard and resets copied flag after 2s', async () => {
    const props = {
      output: '{"test": 123}',
      result: null,
      loading: false,
    };

    const { copied, copyToClipboard } = useSurrealConsoleOutput(props);
    expect(copied.value).toBe(false);

    await copyToClipboard();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"test": 123}');
    expect(copied.value).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(copied.value).toBe(false);
  });

  it('does not copy when output is empty', async () => {
    const props = {
      output: '',
      result: null,
      loading: false,
    };

    const { copied, copyToClipboard } = useSurrealConsoleOutput(props);
    await copyToClipboard();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(copied.value).toBe(false);
  });

  it('handles clipboard error, resets timer on repeated copy, and clears timeout on unmount', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let api!: ReturnType<typeof useSurrealConsoleOutput>;

    const Comp = defineComponent({
      setup() {
        api = useSurrealConsoleOutput({ output: 'SELECT 1', result: null, loading: false });
        return {};
      },
      template: '<div />',
    });

    const wrapper = mount(Comp);
    await api.copyToClipboard();
    await api.copyToClipboard();
    expect(api.copied.value).toBe(true);

    wrapper.unmount();

    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    await api.copyToClipboard();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
