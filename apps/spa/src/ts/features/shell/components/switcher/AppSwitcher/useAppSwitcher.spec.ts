import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useAppSwitcher } from './useAppSwitcher';
import * as api from '@/services/api.client';
import { appConfirm, appAlert } from '@worldwiki/components';
import { listen } from '@tauri-apps/api/event';

vi.mock('@/services/api.client', () => ({
  getLaunchArgs: vi.fn(),
  restoreFromBackup: vi.fn()
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn(),
  appAlert: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}));

describe('useAppSwitcher', () => {
  let unlistenMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    unlistenMock = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlistenMock);
    vi.mocked(api.getLaunchArgs).mockResolvedValue(null);
    vi.mocked(api.restoreFromBackup).mockResolvedValue(undefined);
    vi.mocked(appConfirm).mockResolvedValue(true);
    vi.mocked(appAlert).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handleWwikiPath returns false for non-wwiki file', async () => {
    const { handleWwikiPath } = useAppSwitcher();
    const result = await handleWwikiPath('document.txt');
    expect(result).toBe(false);
    expect(appConfirm).not.toHaveBeenCalled();
    expect(api.restoreFromBackup).not.toHaveBeenCalled();
  });

  it('handleWwikiPath prompts user and cancels if user declines', async () => {
    vi.mocked(appConfirm).mockResolvedValue(false);
    const { handleWwikiPath } = useAppSwitcher();

    const result = await handleWwikiPath('C:/Users/Danila/Desktop/backup.wwiki');
    expect(result).toBe(false);
    expect(appConfirm).toHaveBeenCalledWith(
      expect.stringContaining('backup.wwiki'),
      'Открытие резервной копии WorldWiki'
    );
    expect(api.restoreFromBackup).not.toHaveBeenCalled();
  });

  it('handleWwikiPath restores backup and alerts on success', async () => {
    vi.mocked(appConfirm).mockResolvedValue(true);
    const { handleWwikiPath } = useAppSwitcher();

    const result = await handleWwikiPath('/path/to/my_story.wwiki');
    expect(result).toBe(true);
    expect(api.restoreFromBackup).toHaveBeenCalledWith('/path/to/my_story.wwiki');
    expect(appAlert).toHaveBeenCalledWith(
      expect.stringContaining('my_story.wwiki'),
      'Восстановление завершено'
    );
  });

  it('handleWwikiPath alerts error if restore fails', async () => {
    vi.mocked(appConfirm).mockResolvedValue(true);
    vi.mocked(api.restoreFromBackup).mockRejectedValue(new Error('Corrupt zip archive'));
    const { handleWwikiPath } = useAppSwitcher();

    const result = await handleWwikiPath('broken.wwiki');
    expect(result).toBe(false);
    expect(appAlert).toHaveBeenCalledWith(
      expect.stringContaining('Corrupt zip archive'),
      'Ошибка восстановления'
    );
  });

  it('ignores concurrent prompt and handles non-Error rejection', async () => {
    let resolveConfirm!: (v: boolean) => void;
    vi.mocked(appConfirm).mockReturnValueOnce(new Promise((r) => { resolveConfirm = r; }));
    const { handleWwikiPath } = useAppSwitcher();

    const first = handleWwikiPath('first.wwiki');
    const second = await handleWwikiPath('second.wwiki');
    expect(second).toBe(false);

    resolveConfirm(false);
    expect(await first).toBe(false);

    vi.mocked(appConfirm).mockResolvedValueOnce(true);
    vi.mocked(api.restoreFromBackup).mockRejectedValueOnce('raw string fail');
    expect(await handleWwikiPath('broken.wwiki')).toBe(false);
    expect(appAlert).toHaveBeenCalledWith(
      expect.stringContaining('raw string fail'),
      'Ошибка восстановления'
    );
  });

  it('checks launch args on mount, listens for open-wwiki-file, and cleans up on unmount', async () => {
    let listenerCb: ((ev: { payload: string }) => void) | null = null;
    vi.mocked(api.getLaunchArgs).mockResolvedValueOnce('launch.wwiki');
    vi.mocked(appConfirm).mockResolvedValue(false);
    vi.mocked(listen).mockImplementationOnce(async (_evt, cb) => {
      listenerCb = cb as any;
      return unlistenMock;
    });

    const Comp = defineComponent({
      setup() {
        return useAppSwitcher();
      },
      template: '<div />',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    expect(api.getLaunchArgs).toHaveBeenCalled();
    expect(appConfirm).toHaveBeenCalledWith(
      expect.stringContaining('launch.wwiki'),
      'Открытие резервной копии WorldWiki'
    );

    listenerCb?.({ payload: '' });
    listenerCb?.({ payload: 'event.wwiki' });
    await flushPromises();
    expect(appConfirm).toHaveBeenCalledWith(
      expect.stringContaining('event.wwiki'),
      'Открытие резервной копии WorldWiki'
    );

    wrapper.unmount();
    expect(unlistenMock).toHaveBeenCalled();
  });

  it('warns gracefully when getLaunchArgs or listen fails on mount', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(api.getLaunchArgs).mockRejectedValueOnce(new Error('args err'));
    vi.mocked(listen).mockRejectedValueOnce(new Error('listen err'));

    const Comp = defineComponent({
      setup() {
        return useAppSwitcher();
      },
      template: '<div />',
    });

    const wrapper = mount(Comp);
    await flushPromises();
    expect(warnSpy).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    warnSpy.mockRestore();
  });
});

