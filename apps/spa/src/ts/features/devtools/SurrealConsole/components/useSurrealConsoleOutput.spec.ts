import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSurrealConsoleOutput } from './useSurrealConsoleOutput';

describe('useSurrealConsoleOutput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
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
});
