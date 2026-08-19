import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloudApi } from '../cloud.api';
import { invoke } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  invoke: vi.fn(),
}));

describe('cloudApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createCloudBackup calls invoke create_cloud_backup', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('backup-id-123');

    const res = await cloudApi.createCloudBackup();

    expect(invoke).toHaveBeenCalledWith('create_cloud_backup');
    expect(res).toBe('backup-id-123');
  });

  it('exportChapters calls invoke export_chapters with options', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ path: '/tmp/export.pdf' });

    const res = await cloudApi.exportChapters('p1', [{ id: 'c1' }], 'pdf', { title: 'Book' });

    expect(invoke).toHaveBeenCalledWith('export_chapters', {
      project: 'p1',
      chapters: [{ id: 'c1' }],
      format: 'pdf',
      options: { title: 'Book' },
    });
    expect(res).toEqual({ path: '/tmp/export.pdf' });
  });

  it('exchangeYandexToken calls invoke exchange_yandex_token', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('oauth-token-xyz');

    const res = await cloudApi.exchangeYandexToken('auth-code-123');

    expect(invoke).toHaveBeenCalledWith('exchange_yandex_token', { code: 'auth-code-123' });
    expect(res).toBe('oauth-token-xyz');
  });

  it('uploadToYandexDisk calls invoke upload_to_yandex_disk', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await cloudApi.uploadToYandexDisk('tok-1', '/path/to/file');

    expect(invoke).toHaveBeenCalledWith('upload_to_yandex_disk', { token: 'tok-1', filePath: '/path/to/file' });
  });

  it('restoreFromBackup calls invoke restore_from_backup', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await cloudApi.restoreFromBackup('/path/to/backup.zip');

    expect(invoke).toHaveBeenCalledWith('restore_from_backup', { backupPath: '/path/to/backup.zip' });
  });

  it('getLaunchArgs calls invoke get_launch_args', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('--open-file=/doc.ww');

    const res = await cloudApi.getLaunchArgs();

    expect(invoke).toHaveBeenCalledWith('get_launch_args');
    expect(res).toBe('--open-file=/doc.ww');
  });
});
