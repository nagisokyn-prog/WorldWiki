import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
});

