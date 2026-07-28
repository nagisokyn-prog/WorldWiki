import { ref, onMounted, onUnmounted } from 'vue';
import * as api from '../../services/api.client';;

const YANDEX_CLIENT_ID = '200295d252b44387a21ec64a80d7d124';

export function useCloudSyncModal(emit: any) {
    const isOpen = ref(false);
    const syncMode = ref<'import' | 'export'>('export');
    const yandexToken = ref<string | null>(null);
    const showAuthCodeInput = ref(false);
    const authCode = ref('');
    const authError = ref('');
    const isLoading = ref(false);
    const isSyncing = ref(false);

    const loadToken = () => {
        yandexToken.value = localStorage.getItem('yandex_disk_token');
    };

    const openModal = (mode: 'import' | 'export' = 'export') => {
        syncMode.value = mode;
        isOpen.value = true;
        loadToken();
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
        openModal(customEvent.detail || 'export');
    };

    onMounted(() => {
        window.addEventListener('open-cloud-sync', handleOpenEvent);
    });

    onUnmounted(() => {
        window.removeEventListener('open-cloud-sync', handleOpenEvent);
    });

    const connectYandex = async () => {
        const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}`;
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
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
        emit('toast', { text: 'Яндекс.Диск отключен', type: 'info' });
    };

    const exchangeCode = async () => {
        if (!authCode.value) return;
        isLoading.value = true;
        authError.value = '';

        try {
            const token = await (window as any).__TAURI__.core.invoke('exchange_yandex_token', { code: authCode.value.trim() });
            localStorage.setItem('yandex_disk_token', token);
            yandexToken.value = token;
            showAuthCodeInput.value = false;
            authCode.value = '';
            emit('toast', { text: 'Яндекс.Диск успешно подключен!', type: 'success' });
        } catch (err: any) {
            console.error(err);
            authError.value = typeof err === 'string' ? err : 'Ошибка сети при проверке кода';
        } finally {
            isLoading.value = false;
        }
    };

    const uploadBackup = async () => {
        if (!yandexToken.value) return;
        isSyncing.value = true;

        try {
            emit('toast', { text: 'Создаем локальный бекап...', type: 'info' });

            const backupFilePath = await api.createCloudBackup();
            emit('toast', { text: 'Бекап создан, отправляем в облако...', type: 'info' });

            await (window as any).__TAURI__.core.invoke('upload_to_yandex_disk', {
                token: yandexToken.value,
                filePath: backupFilePath
            });

            emit('toast', { text: 'Бекап успешно сохранен в Яндекс.Диск!', type: 'success' });

        } catch (err: any) {
            console.error(err);
            const errMsg = typeof err === 'string' ? err : err.message;
            if (errMsg && errMsg.includes('Token expired')) disconnectYandex();
            emit('toast', { text: `Ошибка: ${errMsg}`, type: 'error' });
        } finally {
            isSyncing.value = false;
        }
    };

    const restoreBackup = async () => {
        if (!yandexToken.value) return;
        isSyncing.value = true;

        try {
            emit('toast', { text: 'Функция восстановления еще в разработке...', type: 'info' });
        } catch (err: any) {
            console.error(err);
            emit('toast', { text: `Ошибка: ${err.message}`, type: 'error' });
        } finally {
            isSyncing.value = false;
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
        openModal,
        close,
        connectYandex,
        disconnectYandex,
        exchangeCode,
        uploadBackup,
        restoreBackup
    };
}