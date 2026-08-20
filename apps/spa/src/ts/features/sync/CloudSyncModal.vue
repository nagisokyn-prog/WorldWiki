<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="cloud-sync-overlay" @click.self="close">
      <div v-motion-pop class="cloud-sync-modal">
        <div class="cloud-sync-header">
          <h3>
            <i class="fas fa-cloud"></i>
            Синхронизация
          </h3>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <div class="cloud-sync-body relative">
          <!-- Оверлей загрузки -->
          <div v-if="isSyncing" class="sync-loading-overlay">
            <i class="fas fa-circle-notch fa-spin sync-loading-spinner"></i>
            <div class="font-medium text-base">{{ syncMode === 'import' ? 'Восстановление проекта...' : 'Отправка в облако...' }}</div>
            <div class="text-xs text-muted mt-2 text-center">Пожалуйста, не закрывайте окно<br>и дождитесь завершения</div>
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
          <div v-if="showAuthCodeInput" v-motion-slide-top class="auth-code-section">
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
            <p v-if="authError" class="text-error mt-2">{{ authError }}</p>
          </div>

          <div class="mt-6 pt-6 border-t">
            <!-- EXPORT MODE -->
            <template v-if="syncMode === 'export'">
              <div class="flex gap-3 items-center justify-center">
                <button 
                  class="btn-sync-primary interactive-el"
                  :disabled="!yandexToken || isSyncing"
                  @click="uploadBackup"
                >
                  <i class="fas fa-cloud-upload-alt"></i>
                  Отправить бекап в облако
                </button>
              </div>
              <p class="text-center mt-3 text-xs text-muted">
                Архив текущего состояния проекта будет сохранен в папке <b>Приложения/WorldWiki</b> на вашем Яндекс.Диске.
              </p>
            </template>

            <!-- IMPORT MODE -->
            <template v-else-if="syncMode === 'import'">
              <div v-if="!yandexToken" class="text-center text-muted text-sm">
                Подключите Яндекс.Диск для загрузки бекапов
              </div>
              <div v-else>
                <div class="flex justify-between items-center mb-3">
                  <h4 class="m-0 text-sm">Доступные бекапы</h4>
                  <button class="btn btn-secondary text-xs px-2 py-1" :disabled="isLoadingBackups" title="Обновить список" @click="fetchBackupsList">
                    <i class="fas fa-sync-alt" :class="{'fa-spin': isLoadingBackups}"></i> Обновить
                  </button>
                </div>
                
                <div v-if="isLoadingBackups" class="text-center p-5 text-muted">
                  <i class="fas fa-spinner fa-spin"></i> Загрузка списка...
                </div>
                <div v-else-if="availableBackups.length === 0" class="text-center p-5 text-muted border border-dashed rounded-md">
                  Бекапы не найдены в папке Приложения/WorldWiki
                </div>
                <div v-else class="flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  <div v-for="backup in availableBackups" :key="backup.name" class="backup-item-row">
                    <div class="flex-col gap-1">
                      <div class="text-sm font-medium break-all"><i class="far fa-file-archive mr-1 text-muted"></i>{{ backup.name }}</div>
                      <div class="text-xs text-muted">{{ new Date(backup.created).toLocaleString() }} • {{ (backup.size / 1024 / 1024).toFixed(2) }} MB</div>
                    </div>
                    <button class="btn btn-yandex text-xs px-3 py-1 whitespace-nowrap ml-3" :disabled="isSyncing" @click="restoreBackup(backup.name)">
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
import { useCloudSyncModal, type CloudSyncEmit } from './useCloudSyncModal';

const emit = defineEmits<CloudSyncEmit>();

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

<style scoped src="@worldwiki/resources/styles/features/shell/CloudSyncModal.css"></style>
