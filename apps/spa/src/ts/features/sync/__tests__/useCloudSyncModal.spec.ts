// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCloudSyncModal } from '../useCloudSyncModal';
import * as api from '../../../services/api.client';

vi.mock('../../../services/api.client', () => ({
  createCloudBackup: vi.fn(),
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn().mockResolvedValue(true),
}));

describe('useCloudSyncModal', () => {
  let emit: ReturnType<typeof vi.fn>;
  let modal: ReturnType<typeof useCloudSyncModal>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    emit = vi.fn();
    (window as any).__TAURI__ = {
      core: {
        invoke: vi.fn(),
      },
    };
    modal = useCloudSyncModal(emit);
  });

  describe('Modal opening and closing', () => {
    it('opens modal and loads token', () => {
      localStorage.setItem('yandex_disk_token', 'token_123');
      modal.openModal('export');

      expect(modal.isOpen.value).toBe(true);
      expect(modal.syncMode.value).toBe('export');
      expect(modal.yandexToken.value).toBe('token_123');
    });

    it('closes modal and clears auth state', () => {
      modal.isOpen.value = true;
      modal.authCode.value = '12345';
      modal.close();

      expect(modal.isOpen.value).toBe(false);
      expect(modal.authCode.value).toBe('');
      expect(emit).toHaveBeenCalledWith('close');
    });
  });

  describe('disconnectYandex', () => {
    it('removes token from storage and clears backups', () => {
      localStorage.setItem('yandex_disk_token', 'token_123');
      modal.yandexToken.value = 'token_123';
      modal.availableBackups.value = [{ name: 'b1', created: '2024', size: 100 }];

      modal.disconnectYandex();

      expect(localStorage.getItem('yandex_disk_token')).toBeNull();
      expect(modal.yandexToken.value).toBeNull();
      expect(modal.availableBackups.value).toEqual([]);
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'info' }));
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for token and updates state', async () => {
      modal.authCode.value = 'auth_code_xyz';
      (window as any).__TAURI__.core.invoke.mockResolvedValue('jwt_token_abc');

      await modal.exchangeCode();

      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('exchange_yandex_token', { code: 'auth_code_xyz' });
      expect(localStorage.getItem('yandex_disk_token')).toBe('jwt_token_abc');
      expect(modal.yandexToken.value).toBe('jwt_token_abc');
      expect(modal.showAuthCodeInput.value).toBe(false);
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'success' }));
    });

    it('handles exchange error gracefully', async () => {
      modal.authCode.value = 'bad_code';
      (window as any).__TAURI__.core.invoke.mockRejectedValue('Invalid authorization code');

      await modal.exchangeCode();

      expect(modal.authError.value).toBe('Invalid authorization code');
    });
  });

  describe('uploadBackup', () => {
    it('creates local backup and uploads to Yandex.Disk', async () => {
      modal.yandexToken.value = 'token_123';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      (window as any).__TAURI__.core.invoke.mockResolvedValue('ok');

      await modal.uploadBackup();

      expect(api.createCloudBackup).toHaveBeenCalled();
      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('upload_to_yandex_disk', {
        token: 'token_123',
        filePath: '/tmp/backup.zip',
      });
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'success' }));
    });

    it('handles 401 error by disconnecting Yandex token', async () => {
      modal.yandexToken.value = 'expired_token';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      (window as any).__TAURI__.core.invoke.mockRejectedValue(new Error('401 Unauthorized'));

      await modal.uploadBackup();

      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });
  });
});
