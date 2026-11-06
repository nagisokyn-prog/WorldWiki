// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useCloudSyncModal, type CloudSyncEmit } from '../useCloudSyncModal';
import * as api from '@/services/api.client';
import { appConfirm } from '@worldwiki/components';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/services/api.client', () => ({
  createCloudBackup: vi.fn(),
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn(),
}));

const { mockOpenUrl } = vi.hoisted(() => ({
  mockOpenUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: mockOpenUrl,
}));

describe('useCloudSyncModal', () => {
  let emit: CloudSyncEmit & ReturnType<typeof vi.fn>;
  let modal: ReturnType<typeof useCloudSyncModal>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    emit = vi.fn() as unknown as CloudSyncEmit & ReturnType<typeof vi.fn>;
    (window as any).__TAURI__ = {
      core: {
        invoke: vi.mocked(invoke),
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

    it('opens modal with import mode and triggers fetchBackupsList', async () => {
      localStorage.setItem('yandex_disk_token', 'token_123');
      vi.mocked(invoke).mockResolvedValue([
        { name: 'backup1.zip', created: '2024-01-01', size: 1024 }
      ]);

      modal.openModal('import');
      expect(modal.isOpen.value).toBe(true);
      expect(modal.syncMode.value).toBe('import');
    });

    it('closes modal and clears auth state', () => {
      modal.isOpen.value = true;
      modal.authCode.value = '12345';
      modal.close();

      expect(modal.isOpen.value).toBe(false);
      expect(modal.authCode.value).toBe('');
      expect(emit).toHaveBeenCalledWith('close');
    });

    it('responds to open-cloud-sync custom event', () => {
      let modalInstance: any;
      const Comp = defineComponent({
        setup() {
          modalInstance = useCloudSyncModal(emit);
          return () => null;
        }
      });
      const wrapper = mount(Comp);
      const event = new CustomEvent('open-cloud-sync', { detail: 'import' });
      window.dispatchEvent(event);

      expect(modalInstance.isOpen.value).toBe(true);
      expect(modalInstance.syncMode.value).toBe('import');
      wrapper.unmount();
    });
    it('opens modal with default parameter and handles customEvent without detail', () => {
      modal.openModal();
      expect(modal.isOpen.value).toBe(true);
      expect(modal.syncMode.value).toBe('export');

      let modalInstance: any;
      const Comp = defineComponent({
        setup() {
          modalInstance = useCloudSyncModal(emit);
          return () => null;
        }
      });
      const wrapper = mount(Comp);
      const event = new CustomEvent('open-cloud-sync', { detail: undefined });
      window.dispatchEvent(event);
      expect(modalInstance.syncMode.value).toBe('export');
      wrapper.unmount();
    });

    it('handles open-cloud-sync when detail is an object with mode', () => {
      let modalInstance: any;
      const Comp = defineComponent({
        setup() {
          modalInstance = useCloudSyncModal(emit);
          return () => null;
        }
      });
      const wrapper = mount(Comp);
      const event = new CustomEvent('open-cloud-sync', { detail: { mode: 'import' } });
      window.dispatchEvent(event);
      expect(modalInstance.isOpen.value).toBe(true);
      expect(modalInstance.syncMode.value).toBe('import');
      wrapper.unmount();
    });
  });

  describe('openAuthUrl', () => {
    it('opens auth url and sets showAuthCodeInput', async () => {
      await modal.connectYandex();

      expect(mockOpenUrl).toHaveBeenCalledWith(expect.stringContaining('oauth.yandex.ru/authorize'));
      expect(modal.showAuthCodeInput.value).toBe(true);
    });

    it('handles error when openUrl fails', async () => {
      mockOpenUrl.mockRejectedValueOnce(new Error('Browser failed'));

      await modal.connectYandex();
      expect(modal.showAuthCodeInput.value).toBe(true);
    });
  });

  describe('disconnectYandex', () => {
    it('clears token and state', () => {
      localStorage.setItem('yandex_disk_token', 'token_123');
      modal.yandexToken.value = 'token_123';
      modal.availableBackups.value = [{ name: 'bk.zip', created: 'now', size: 100 }];

      modal.disconnectYandex();

      expect(localStorage.getItem('yandex_disk_token')).toBeNull();
      expect(modal.yandexToken.value).toBeNull();
      expect(modal.availableBackups.value).toEqual([]);
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'info' }));
    });
  });

  describe('fetchBackupsList', () => {
    it('returns early if no token is present', async () => {
      modal.yandexToken.value = null;
      await modal.fetchBackupsList();
      expect(invoke).not.toHaveBeenCalled();
    });

    it('fetches backups when token exists', async () => {
      modal.yandexToken.value = 'tok123';
      const mockList = [{ name: 'bk.zip', created: 'now', size: 2048 }];
      vi.mocked(invoke).mockResolvedValue(mockList);

      await modal.fetchBackupsList();
      expect(modal.availableBackups.value).toEqual(mockList);
    });

    it('handles 401 error during fetchBackupsList and disconnects', async () => {
      modal.yandexToken.value = 'expired_tok';
      vi.mocked(invoke).mockRejectedValue('Error: 401 Unauthorized');

      await modal.fetchBackupsList();
      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });

    it('handles non-401 error during fetchBackupsList without disconnecting', async () => {
      modal.yandexToken.value = 'valid_tok';
      vi.mocked(invoke).mockRejectedValue(new Error('Network timeout'));

      await modal.fetchBackupsList();
      expect(modal.yandexToken.value).toBe('valid_tok');
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ text: expect.stringContaining('Network timeout') }));
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for token and updates state, fetching backups in import mode', async () => {
      modal.syncMode.value = 'import';
      modal.authCode.value = 'auth_code_xyz';
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'exchange_yandex_token') return 'jwt_token_abc';
        if (cmd === 'list_yandex_disk_backups') return [{ name: 'b1.zip' }];
        return null;
      });

      await modal.exchangeCode();

      expect(invoke).toHaveBeenCalledWith('exchange_yandex_token', { code: 'auth_code_xyz' });
      expect(localStorage.getItem('yandex_disk_token')).toBe('jwt_token_abc');
      expect(modal.yandexToken.value).toBe('jwt_token_abc');
      expect(modal.showAuthCodeInput.value).toBe(false);
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'success' }));
      expect(modal.availableBackups.value).toEqual([{ name: 'b1.zip' }]);
    });

    it('exchanges code in export mode without fetching backups', async () => {
      modal.syncMode.value = 'export';
      modal.authCode.value = 'code_export';
      vi.mocked(invoke).mockResolvedValue('jwt_token_export');

      await modal.exchangeCode();
      expect(modal.yandexToken.value).toBe('jwt_token_export');
      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('handles exchange error gracefully with string error', async () => {
      modal.authCode.value = 'bad_code';
      vi.mocked(invoke).mockRejectedValue('Invalid authorization code');

      await modal.exchangeCode();

      expect(modal.authError.value).toBe('Invalid authorization code');
    });

    it('handles exchange error gracefully with object error', async () => {
      modal.authCode.value = 'bad_code';
      vi.mocked(invoke).mockRejectedValue(new Error('Network error'));

      await modal.exchangeCode();

      expect(modal.authError.value).toBe('Network error');

      // Generic object error
      vi.mocked(invoke).mockRejectedValue({ code: 500 });
      await modal.exchangeCode();
      expect(modal.authError.value).toBe('Ошибка сети при проверке кода');
    });

    it('does nothing if authCode is empty', async () => {
      modal.authCode.value = '';
      await modal.exchangeCode();
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('uploadBackup', () => {
    it('returns early if no token is present', async () => {
      modal.yandexToken.value = null;
      await modal.uploadBackup();
      expect(api.createCloudBackup).not.toHaveBeenCalled();
    });

    it('creates local backup and uploads to Yandex.Disk', async () => {
      modal.yandexToken.value = 'token_123';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      vi.mocked(invoke).mockResolvedValue('ok');

      await modal.uploadBackup();

      expect(api.createCloudBackup).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith('upload_to_yandex_disk', {
        token: 'token_123',
        filePath: '/tmp/backup.zip',
      });
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'success' }));
    });

    it('handles 401 error by disconnecting Yandex token', async () => {
      modal.yandexToken.value = 'expired_token';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      vi.mocked(invoke).mockRejectedValue(new Error('401 Unauthorized'));

      await modal.uploadBackup();

      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });

    it('handles Token expired string error by disconnecting Yandex token', async () => {
      modal.yandexToken.value = 'expired_token';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      vi.mocked(invoke).mockRejectedValue('Token expired');

      await modal.uploadBackup();

      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });

    it('handles general upload error without disconnecting', async () => {
      modal.yandexToken.value = 'valid_token';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      vi.mocked(invoke).mockRejectedValue(new Error('Disk full'));

      await modal.uploadBackup();

      expect(modal.yandexToken.value).toBe('valid_token');
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ text: expect.stringContaining('Disk full') }));
    });
  });

  describe('restoreBackup', () => {
    it('returns early if no token is present', async () => {
      modal.yandexToken.value = null;
      await modal.restoreBackup('backup.zip');
      expect(appConfirm).not.toHaveBeenCalled();
    });

    it('aborts restore if user declines confirmation', async () => {
      modal.yandexToken.value = 'tok';
      vi.mocked(appConfirm).mockResolvedValue(false);

      await modal.restoreBackup('backup.zip');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('restores backup when confirmed and triggers success toast', async () => {
      vi.useFakeTimers();

      modal.yandexToken.value = 'tok';
      vi.mocked(appConfirm).mockResolvedValue(true);
      vi.mocked(invoke).mockResolvedValue('ok');

      await modal.restoreBackup('backup.zip');

      expect(invoke).toHaveBeenCalledWith('download_and_restore_yandex', {
        token: 'tok',
        fileName: 'backup.zip',
      });
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'success' }));
      
      vi.advanceTimersByTime(1500);
      vi.useRealTimers();
    });

    it('handles restore error and disconnects on 401', async () => {
      modal.yandexToken.value = 'tok';
      vi.mocked(appConfirm).mockResolvedValue(true);
      vi.mocked(invoke).mockRejectedValue(new Error('401 Unauthorized'));

      await modal.restoreBackup('backup.zip');

      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });

    it('handles restore error with string without disconnecting when not 401', async () => {
      modal.yandexToken.value = 'tok';
      vi.mocked(appConfirm).mockResolvedValue(true);
      vi.mocked(invoke).mockRejectedValue('Corrupted archive');

      await modal.restoreBackup('backup.zip');

      expect(modal.yandexToken.value).toBe('tok');
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ text: expect.stringContaining('Corrupted archive') }));
    });
  });
});
