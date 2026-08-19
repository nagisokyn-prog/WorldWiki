// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useCloudSyncModal } from '../useCloudSyncModal';
import * as api from '../../../services/api.client';
import { appConfirm } from '@worldwiki/components';

vi.mock('../../../services/api.client', () => ({
  createCloudBackup: vi.fn(),
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
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

    it('opens modal with import mode and triggers fetchBackupsList', async () => {
      localStorage.setItem('yandex_disk_token', 'token_123');
      (window as any).__TAURI__.core.invoke.mockResolvedValue([
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

    it('does not fetch backups on openModal import if no token', () => {
      localStorage.removeItem('yandex_disk_token');
      modal.openModal('import');
      expect(modal.isOpen.value).toBe(true);
      expect((window as any).__TAURI__.core.invoke).not.toHaveBeenCalled();
    });
  });

  describe('connectYandex', () => {
    it('opens browser with oauth url and shows auth code input', async () => {
      await modal.connectYandex();
      expect(modal.showAuthCodeInput.value).toBe(true);
      expect(modal.authError.value).toBe('');
    });

    it('handles openUrl failure and sets authError', async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      vi.mocked(openUrl).mockRejectedValueOnce(new Error('Browser open failed'));

      await modal.connectYandex();
      expect(modal.showAuthCodeInput.value).toBe(true);
      expect(modal.authError.value).toContain('Не удалось открыть браузер');
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

  describe('fetchBackupsList', () => {
    it('returns early if no token is present', async () => {
      modal.yandexToken.value = null;
      await modal.fetchBackupsList();
      expect((window as any).__TAURI__.core.invoke).not.toHaveBeenCalled();
    });

    it('fetches backups when token exists', async () => {
      modal.yandexToken.value = 'tok123';
      const mockList = [{ name: 'bk.zip', created: 'now', size: 2048 }];
      (window as any).__TAURI__.core.invoke.mockResolvedValue(mockList);

      await modal.fetchBackupsList();
      expect(modal.availableBackups.value).toEqual(mockList);
    });

    it('handles 401 error during fetchBackupsList and disconnects', async () => {
      modal.yandexToken.value = 'expired_tok';
      (window as any).__TAURI__.core.invoke.mockRejectedValue('Error: 401 Unauthorized');

      await modal.fetchBackupsList();
      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });

    it('handles non-401 error during fetchBackupsList without disconnecting', async () => {
      modal.yandexToken.value = 'valid_tok';
      (window as any).__TAURI__.core.invoke.mockRejectedValue(new Error('Network timeout'));

      await modal.fetchBackupsList();
      expect(modal.yandexToken.value).toBe('valid_tok');
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ text: expect.stringContaining('Network timeout') }));
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for token and updates state, fetching backups in import mode', async () => {
      modal.syncMode.value = 'import';
      modal.authCode.value = 'auth_code_xyz';
      (window as any).__TAURI__.core.invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'exchange_yandex_token') return 'jwt_token_abc';
        if (cmd === 'list_yandex_disk_backups') return [{ name: 'b1.zip' }];
        return null;
      });

      await modal.exchangeCode();

      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('exchange_yandex_token', { code: 'auth_code_xyz' });
      expect(localStorage.getItem('yandex_disk_token')).toBe('jwt_token_abc');
      expect(modal.yandexToken.value).toBe('jwt_token_abc');
      expect(modal.showAuthCodeInput.value).toBe(false);
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'success' }));
      expect(modal.availableBackups.value).toEqual([{ name: 'b1.zip' }]);
    });

    it('exchanges code in export mode without fetching backups', async () => {
      modal.syncMode.value = 'export';
      modal.authCode.value = 'code_export';
      (window as any).__TAURI__.core.invoke.mockResolvedValue('jwt_token_export');

      await modal.exchangeCode();
      expect(modal.yandexToken.value).toBe('jwt_token_export');
      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledTimes(1);
    });

    it('handles exchange error gracefully with string error', async () => {
      modal.authCode.value = 'bad_code';
      (window as any).__TAURI__.core.invoke.mockRejectedValue('Invalid authorization code');

      await modal.exchangeCode();

      expect(modal.authError.value).toBe('Invalid authorization code');
    });

    it('handles exchange error gracefully with object error', async () => {
      modal.authCode.value = 'bad_code';
      (window as any).__TAURI__.core.invoke.mockRejectedValue(new Error('Network error'));

      await modal.exchangeCode();

      expect(modal.authError.value).toBe('Ошибка сети при проверке кода');
    });

    it('does nothing if authCode is empty', async () => {
      modal.authCode.value = '';
      await modal.exchangeCode();
      expect((window as any).__TAURI__.core.invoke).not.toHaveBeenCalled();
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

    it('handles Token expired string error by disconnecting Yandex token', async () => {
      modal.yandexToken.value = 'expired_token';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      (window as any).__TAURI__.core.invoke.mockRejectedValue('Token expired');

      await modal.uploadBackup();

      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });

    it('handles general upload error without disconnecting', async () => {
      modal.yandexToken.value = 'valid_token';
      vi.mocked(api.createCloudBackup).mockResolvedValue('/tmp/backup.zip');
      (window as any).__TAURI__.core.invoke.mockRejectedValue(new Error('Disk full'));

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
      expect((window as any).__TAURI__.core.invoke).not.toHaveBeenCalled();
    });

    it('restores backup when confirmed and triggers success toast', async () => {
      vi.useFakeTimers();
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
        configurable: true,
      });

      modal.yandexToken.value = 'tok';
      vi.mocked(appConfirm).mockResolvedValue(true);
      (window as any).__TAURI__.core.invoke.mockResolvedValue('ok');

      await modal.restoreBackup('backup.zip');

      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('download_and_restore_yandex', {
        token: 'tok',
        fileName: 'backup.zip',
      });
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'success' }));
      
      vi.advanceTimersByTime(1500);
      expect(reloadMock).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('handles restore error and disconnects on 401', async () => {
      modal.yandexToken.value = 'tok';
      vi.mocked(appConfirm).mockResolvedValue(true);
      (window as any).__TAURI__.core.invoke.mockRejectedValue(new Error('401 Unauthorized'));

      await modal.restoreBackup('backup.zip');

      expect(modal.yandexToken.value).toBeNull();
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ type: 'error' }));
    });

    it('handles restore error with string without disconnecting when not 401', async () => {
      modal.yandexToken.value = 'tok';
      vi.mocked(appConfirm).mockResolvedValue(true);
      (window as any).__TAURI__.core.invoke.mockRejectedValue('Corrupted archive');

      await modal.restoreBackup('backup.zip');

      expect(modal.yandexToken.value).toBe('tok');
      expect(emit).toHaveBeenCalledWith('toast', expect.objectContaining({ text: expect.stringContaining('Corrupted archive') }));
    });
  });
});
