<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="cloud-sync-overlay" @click.self="close">
      <div class="cloud-sync-modal" v-motion-pop>
        <div class="cloud-sync-header">
          <h3>
            <i class="fas fa-cloud"></i>
            Синхронизация
          </h3>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <div class="cloud-sync-body" style="position: relative;">
          <!-- Оверлей загрузки -->
          <div v-if="isSyncing" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg-color); opacity: 0.9; backdrop-filter: blur(4px); z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px;">
            <i class="fas fa-circle-notch fa-spin" style="font-size: 32px; color: var(--accent-color); margin-bottom: 16px;"></i>
            <div style="font-weight: 500; font-size: 15px;">{{ syncMode === 'import' ? 'Восстановление проекта...' : 'Отправка в облако...' }}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px; text-align: center;">Пожалуйста, не закрывайте окно<br>и дождитесь завершения</div>
          </div>
          <div class="cloud-provider-card">
            <div class="provider-info">
              <div class="provider-icon yandex-icon">
                <i class="fab fa-yandex-international"></i>
              </div>
              <div class="provider-details">
                <h4>Яндекс.Диск</h4>
                <p v-if="yandexToken" class="text-success"><i class="fas fa-check-circle"></i> Подключен</p>
                <p v-else>Сохраняйте бекапы в облаке</p>
              </div>
            </div>
            
            <button v-if="yandexToken" class="btn btn-secondary" @click="disconnectYandex">Отключить</button>
            <button v-else class="btn btn-yandex" @click="connectYandex">Подключить</button>
          </div>

          <!-- Поле ввода кода авторизации -->
          <div v-if="showAuthCodeInput" class="auth-code-section" v-motion-slide-top>
            <p class="help-text">
              Скопируйте код из открывшегося окна браузера и вставьте его сюда:
            </p>
            <div class="code-input-group">
              <input 
                v-model="authCode" 
                type="text" 
                placeholder="Например: 1234567" 
                @keyup.enter="exchangeCode"
              >
              <button class="btn btn-yandex" :disabled="isLoading || !authCode" @click="exchangeCode">
                {{ isLoading ? 'Подключение...' : 'Подтвердить' }}
              </button>
            </div>
            <p v-if="authError" class="text-error" style="margin-top: 8px;">{{ authError }}</p>
          </div>

          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color);">
            <!-- EXPORT MODE -->
            <template v-if="syncMode === 'export'">
              <div style="display: flex; gap: 12px; align-items: center; justify-content: center;">
                <button 
                  class="btn-sync-primary interactive-el"
                  :disabled="!yandexToken || isSyncing"
                  @click="uploadBackup"
                >
                  <i class="fas fa-cloud-upload-alt"></i>
                  Отправить бекап в облако
                </button>
              </div>
              <p style="text-align: center; margin-top: 12px; font-size: 12px; color: var(--text-muted);">
                Архив текущего состояния проекта будет сохранен в папке <b>Приложения/WorldWiki</b> на вашем Яндекс.Диске.
              </p>
            </template>

            <!-- IMPORT MODE -->
            <template v-else-if="syncMode === 'import'">
              <div v-if="!yandexToken" style="text-align: center; color: var(--text-muted); font-size: 13px;">
                Подключите Яндекс.Диск для загрузки бекапов
              </div>
              <div v-else>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <h4 style="margin: 0; font-size: 14px;">Доступные бекапы</h4>
                  <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" @click="fetchBackupsList" :disabled="isLoadingBackups" title="Обновить список">
                    <i class="fas fa-sync-alt" :class="{'fa-spin': isLoadingBackups}"></i> Обновить
                  </button>
                </div>
                
                <div v-if="isLoadingBackups" style="text-align: center; padding: 20px; color: var(--text-muted);">
                  <i class="fas fa-spinner fa-spin"></i> Загрузка списка...
                </div>
                <div v-else-if="availableBackups.length === 0" style="text-align: center; padding: 20px; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 6px;">
                  Бекапы не найдены в папке Приложения/WorldWiki
                </div>
                <div v-else style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
                  <div v-for="backup in availableBackups" :key="backup.name" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <div style="font-size: 13px; font-weight: 500; word-break: break-all;"><i class="far fa-file-archive" style="margin-right: 6px; color: var(--text-muted);"></i>{{ backup.name }}</div>
                      <div style="font-size: 11px; color: var(--text-muted);">{{ new Date(backup.created).toLocaleString() }} • {{ (backup.size / 1024 / 1024).toFixed(2) }} MB</div>
                    </div>
                    <button class="btn btn-yandex" style="padding: 6px 12px; font-size: 12px; white-space: nowrap; margin-left: 12px;" :disabled="isSyncing" @click="restoreBackup(backup.name)">
                      <i class="fas fa-download"></i> Восстановить
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useCloudSyncModal } from './useCloudSyncModal';

const emit = defineEmits(['close', 'toast']);

const {
  isOpen,
  syncMode,
  yandexToken,
  showAuthCodeInput,
  authCode,
  authError,
  isLoading,
  isSyncing,
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
} = useCloudSyncModal(emit);

defineExpose({ open: openModal, close });
</script>

<style scoped src="./CloudSyncModal.vue.css"></style>
