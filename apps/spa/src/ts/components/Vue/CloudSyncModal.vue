<template>
  <div v-if="isOpen" class="cloud-sync-overlay" @click="close">
    <div class="cloud-sync-modal" @click.stop>
      <div class="cloud-sync-header">
        <h3>☁️ Облачная Синхронизация</h3>
        <button class="close-btn interactive-el" @click="close">×</button>
      </div>

      <div class="cloud-sync-body">
        <div class="cloud-provider-card">
          <div class="provider-info">
            <div class="provider-icon yandex-icon">Я</div>
            <div class="provider-details">
              <h4>Яндекс.Диск</h4>
              <p v-if="!yandexToken">Не подключено</p>
              <p v-else class="text-success">Подключено (Токен сохранен)</p>
            </div>
          </div>
          
          <div class="provider-actions">
            <button v-if="!yandexToken" class="btn-new interactive-el btn-yandex" @click="connectYandex">
              Подключить
            </button>
            <button v-else class="btn-new btn-outline-new interactive-el" @click="disconnectYandex">
              Отключить
            </button>
          </div>
        </div>

        <!-- Поле для ввода кода от Яндекса -->
        <div v-if="showAuthCodeInput" class="auth-code-section glass-panel">
          <p class="help-text">Вам должен был открыться браузер. Разрешите доступ и скопируйте 7-значный код подтверждения, затем вставьте его сюда:</p>
          <div class="code-input-group">
            <input type="text" v-model="authCode" placeholder="Код подтверждения..." class="interactive-el">
            <button class="btn-new interactive-el" @click="exchangeCode" :disabled="!authCode || isLoading">
              {{ isLoading ? 'Проверка...' : 'Подтвердить' }}
            </button>
          </div>
          <p v-if="authError" class="text-error" style="margin-top: 8px;">{{ authError }}</p>
        </div>

        <div class="sync-actions" style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 24px;">
          <template v-if="syncMode === 'export'">
            <button 
              class="btn-new interactive-el btn-sync-primary" 
              :disabled="!yandexToken || isSyncing"
              @click="uploadBackup"
            >
              <span v-if="isSyncing">📦 Упаковка и отправка...</span>
              <span v-else>☁️ Отправить бекап в облако</span>
            </button>
            <p class="help-text" style="margin-top: 12px; text-align: center;">
              Программа создаст полный архив проектов (.zip) и загрузит его в папку <b>Приложения / World Wiki</b> на вашем Яндекс.Диске.
            </p>
          </template>

          <template v-else>
            <button 
              class="btn-new interactive-el btn-sync-primary" 
              :disabled="!yandexToken || isSyncing"
              @click="restoreBackup"
            >
              <span v-if="isSyncing">⬇️ Скачивание и восстановление...</span>
              <span v-else>☁️ Восстановить из облака</span>
            </button>
            <p class="help-text" style="margin-top: 12px; text-align: center;">
              Программа скачает последний архив из папки <b>Приложения / World Wiki</b> и <b>ПОЛНОСТЬЮ ПЕРЕЗАПИШЕТ</b> текущие локальные проекты.
            </p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { apiService } from '../../services/api.service';

const YANDEX_CLIENT_ID = '200295d252b44387a21ec64a80d7d124';
const YANDEX_CLIENT_SECRET = '2c1d8dd57f5e4271a74249f6c4b58895';

console.log('CloudSyncModal setup is running!');

const isOpen = ref(false);
const syncMode = ref<'import' | 'export'>('export');
const yandexToken = ref<string | null>(null);
const showAuthCodeInput = ref(false);
const authCode = ref('');
const authError = ref('');
const isLoading = ref(false);
const isSyncing = ref(false);

const emit = defineEmits(['close', 'toast']);

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
  console.log('CloudSyncModal mounted, adding event listener');
  window.addEventListener('open-cloud-sync', handleOpenEvent);
});

onUnmounted(() => {
  window.removeEventListener('open-cloud-sync', handleOpenEvent);
});

defineExpose({ open: openModal, close });

const loadToken = () => {
  yandexToken.value = localStorage.getItem('yandex_disk_token');
};

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
    
    // 1. Создаем бекап локально (.zip)
    const backupFilePath = await apiService.createCloudBackup();
    emit('toast', { text: 'Бекап создан, отправляем в облако...', type: 'info' });
    
    // 2. Отправляем в Яндекс.Диск через Rust-бэкенд
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
    // TODO: 1. Get latest backup from Yandex Disk
    // 2. Download zip
    // 3. Call backend command to replace data folder and restart
    
  } catch (err: any) {
    console.error(err);
    emit('toast', { text: `Ошибка: ${err.message}`, type: 'error' });
  } finally {
    isSyncing.value = false;
  }
};
</script>

<style scoped>
.cloud-sync-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cloud-sync-modal {
  width: 500px;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
}

.cloud-sync-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 12px 12px 0 0;
}

.cloud-sync-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-main);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-main);
}

.cloud-sync-body {
  padding: 24px;
}

.cloud-provider-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
}

.provider-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.provider-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  color: white;
}

.yandex-icon {
  background: #FC3F1D;
}

.provider-details h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
}

.provider-details p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.text-success {
  color: #10B981 !important;
}

.text-error {
  color: #EF4444;
  font-size: 13px;
}

.btn-yandex {
  background: #FC3F1D;
  color: white;
  border: none;
}
.btn-yandex:hover {
  background: #E03517;
}

.auth-code-section {
  margin-top: 16px;
  padding: 16px;
  border-radius: 8px;
  background: rgba(252, 63, 29, 0.05);
  border: 1px dashed rgba(252, 63, 29, 0.3);
}

.code-input-group {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.code-input-group input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  color: var(--text-main);
}

.help-text {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
}

.btn-sync-primary {
  width: 100%;
  padding: 12px;
  font-size: 15px;
  background: var(--accent);
  color: white;
  border: none;
  font-weight: 600;
}
.btn-sync-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
