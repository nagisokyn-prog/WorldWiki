import { ref, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import * as api from '@/services/api.client';
import type { MediaSyncProgress, DatabaseSyncStatus, MediaSyncStatus } from './CloudSyncModal.model';

const YANDEX_CLIENT_ID = '200295d252b44387a21ec64a80d7d124';

export interface YandexBackupFile {
    name: string;
    created: string;
    size: number;
}

export type CloudSyncEmit = {
    (e: 'close'): void;
    (e: 'toast', payload: { text: string; type: 'info' | 'success' | 'error' }): void;
};

export function useCloudSyncModal(emit: CloudSyncEmit) {
    const isOpen = ref(false);
    const syncMode = ref<'import' | 'export'>('export');
    const yandexToken = ref<string | null>(null);
    const showAuthCodeInput = ref(false);
    const authCode = ref('');
    const authError = ref('');
    const isLoading = ref(false);
    const isSyncing = ref(false);
    const syncStatusText = ref('');
    const dbSyncStatus = ref<DatabaseSyncStatus>('idle');
    const mediaSyncStatus = ref<MediaSyncStatus>('idle');
    const mediaProgress = ref<MediaSyncProgress | null>(null);
    const uploadedMediaCount = ref(0);
    const lastBackupFileName = ref('');
    
    const availableBackups = ref<YandexBackupFile[]>([]);
    const isLoadingBackups = ref(false);

    let unlistenMediaProgress: UnlistenFn | null = null;

    const loadToken = () => {
        yandexToken.value = localStorage.getItem('yandex_disk_token');
    };
    
    const fetchBackupsList = async () => {
        if (!yandexToken.value) return;
        isLoadingBackups.value = true;
        try {
            const backups = await invoke<YandexBackupFile[]>('list_yandex_disk_backups', {
                token: yandexToken.value
            });
            availableBackups.value = backups;
        } catch (err: unknown) {
            console.error('Failed to list backups:', err);
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg && errMsg.includes('401')) {
                disconnectYandex();
            }
            emit('toast', { text: `Ошибка загрузки списка: ${errMsg}`, type: 'error' });
        } finally {
            isLoadingBackups.value = false;
        }
    };

    const openModal = (mode: 'import' | 'export' = 'export') => {
        syncMode.value = mode;
        isOpen.value = true;
        loadToken();
        if (mode === 'import' && yandexToken.value) {
            fetchBackupsList();
        }
    };

    const close = () => {
        isOpen.value = false;
        showAuthCodeInput.value = false;
        authCode.value = '';
        authError.value = '';
        emit('close');
    };

    const handleOpenEvent = (e: Event) => {
        const customEvent = e as CustomEvent;
        const detail = customEvent.detail;
        const mode = typeof detail === 'string' ? detail : (detail?.mode || 'export');
        openModal(mode);
    };

    onMounted(async () => {
        window.addEventListener('open-cloud-sync', handleOpenEvent);
        try {
            unlistenMediaProgress = await listen<MediaSyncProgress>('sync-media-progress', (event) => {
                mediaProgress.value = event.payload;
            });
        } catch (e) {
            console.error('Failed to attach sync-media-progress listener:', e);
        }
    });

    onUnmounted(() => {
        window.removeEventListener('open-cloud-sync', handleOpenEvent);
        if (unlistenMediaProgress) {
            unlistenMediaProgress();
            unlistenMediaProgress = null;
        }
    });

    const connectYandex = async () => {
        const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}`;
        try {
            await openUrl(url);
            showAuthCodeInput.value = true;
            authError.value = '';
        } catch (err) {
            console.error('Failed to open browser:', err);
            authError.value = 'Не удалось открыть браузер. Пожалуйста, перейдите по ссылке вручную: ' + url;
            showAuthCodeInput.value = true;
        }
    };

    const disconnectYandex = () => {
        localStorage.removeItem('yandex_disk_token');
        yandexToken.value = null;
        availableBackups.value = [];
        emit('toast', { text: 'Яндекс.Диск отключен', type: 'info' });
    };

    const exchangeCode = async () => {
        if (!authCode.value) return;
        isLoading.value = true;
        authError.value = '';

        try {
            const token = await invoke<string>('exchange_yandex_token', { code: authCode.value.trim() });
            localStorage.setItem('yandex_disk_token', token);
            yandexToken.value = token;
            showAuthCodeInput.value = false;
            authCode.value = '';
            emit('toast', { text: 'Яндекс.Диск успешно подключен!', type: 'success' });
            
            if (syncMode.value === 'import') {
                fetchBackupsList();
            }
        } catch (err: unknown) {
            console.error(err);
            authError.value = err instanceof Error ? err.message : (typeof err === 'string' ? err : 'Ошибка сети при проверке кода');
        } finally {
            isLoading.value = false;
        }
    };

    const uploadBackup = async () => {
        if (!yandexToken.value) return;
        isSyncing.value = true;
        mediaSyncStatus.value = 'syncing';
        dbSyncStatus.value = 'idle';
        mediaProgress.value = null;

        try {
            emit('toast', { text: 'Синхронизация медиафайлов...', type: 'info' });
            const mediaCount = await invoke<number>('sync_yandex_media', { token: yandexToken.value });
            uploadedMediaCount.value = mediaCount;
            mediaSyncStatus.value = 'success';
            if (mediaCount > 0) {
                emit('toast', { text: `Загружено новых медиа: ${mediaCount}`, type: 'info' });
            }

            dbSyncStatus.value = 'exporting';
            emit('toast', { text: 'Создаем компактный бекап...', type: 'info' });

            const backupFilePath = await api.createCloudBackup();
            lastBackupFileName.value = backupFilePath.split(/[/\\]/).pop() || 'backup.wwiki';

            dbSyncStatus.value = 'uploading';
            emit('toast', { text: 'Бекап создан, отправляем в облако...', type: 'info' });

            await invoke<void>('upload_to_yandex_disk', {
                token: yandexToken.value,
                filePath: backupFilePath
            });

            dbSyncStatus.value = 'success';
            emit('toast', { text: 'Бекап успешно сохранен в Яндекс.Диск!', type: 'success' });

        } catch (err: unknown) {
            console.error(err);
            if (mediaSyncStatus.value === 'syncing') mediaSyncStatus.value = 'error';
            if (dbSyncStatus.value === 'exporting' || dbSyncStatus.value === 'uploading') dbSyncStatus.value = 'error';

            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg && (errMsg.includes('Token expired') || errMsg.includes('401'))) disconnectYandex();
            emit('toast', { text: `Ошибка: ${errMsg}`, type: 'error' });
        } finally {
            isSyncing.value = false;
        }
    };

    const restoreBackup = async (fileName: string) => {
        if (!yandexToken.value) return;
        const { appConfirm } = await import('@worldwiki/components');
        if (!await appConfirm('ВНИМАНИЕ! Текущий проект будет полностью перезаписан из бекапа. Несохраненные изменения будут утеряны. Вы уверены?')) {
            return;
        }

        isSyncing.value = true;
        syncStatusText.value = 'Скачивание архива и восстановление...';

        try {
            emit('toast', { text: 'Скачивание и восстановление бекапа...', type: 'info' });
            
            await invoke<void>('download_and_restore_yandex', {
                token: yandexToken.value,
                fileName: fileName
            });
            
            syncStatusText.value = 'Проект успешно восстановлен!';
            emit('toast', { text: 'Проект успешно восстановлен! Требуется перезагрузка.', type: 'success' });
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch (err: unknown) {
            console.error(err);
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg && errMsg.includes('401')) disconnectYandex();
            emit('toast', { text: `Ошибка восстановления: ${errMsg}`, type: 'error' });
        } finally {
            isSyncing.value = false;
            syncStatusText.value = '';
        }
    };

    return {
        isOpen,
        syncMode,
        yandexToken,
        showAuthCodeInput,
        authCode,
        authError,
        isLoading,
        isSyncing,
        syncStatusText,
        mediaProgress,
        mediaSyncStatus,
        dbSyncStatus,
        uploadedMediaCount,
        lastBackupFileName,
        availableBackups,
        isLoadingBackups,
        openModal,
        close,
        connectYandex,
        disconnectYandex,
        exchangeCode,
        uploadBackup,
        restoreBackup,
        fetchBackupsList
    };
}