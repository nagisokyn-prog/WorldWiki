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
            
            <button v-if="yandexToken" class="btn btn-secondary" :disabled="isSyncing" @click="disconnectYandex">Отключить</button>
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
              <!-- Карточка раздельной структуры бэкапа -->
              <div class="sync-destinations-card">
                <!-- 1. База данных -->
                <div class="sync-destination-item">
                  <i class="fas fa-database sync-dest-icon"></i>
                  <div class="sync-dest-info">
                    <div class="sync-dest-header">
                      <div class="sync-dest-title-group">
                        <span class="sync-dest-title">База данных и структура</span>
                        <span v-if="dbSyncStatus === 'exporting'" class="badge-status badge-syncing">
                          <i class="fas fa-spinner fa-spin"></i> Экспорт .surql...
                        </span>
                        <span v-else-if="dbSyncStatus === 'uploading'" class="badge-status badge-syncing">
                          <i class="fas fa-arrow-up fa-fade"></i> Загрузка .wwiki...
                        </span>
                        <span v-else-if="dbSyncStatus === 'success'" class="badge-status badge-success">
                          <i class="fas fa-check"></i> Сохранен
                        </span>
                        <span v-else-if="dbSyncStatus === 'error'" class="badge-status badge-error">
                          <i class="fas fa-exclamation-triangle"></i> Сбой
                        </span>
                      </div>
                      <code class="sync-dest-path">Приложения/WorldWiki/</code>
                    </div>
                    <div class="sync-dest-desc">
                      Компактный архив (.wwiki): дамп SurrealDB, настройки и манифест проекта (&lt; 2 МБ).
                    </div>
                    <div v-if="lastBackupFileName" class="text-xs text-muted mt-1 font-mono">
                      <i class="far fa-file-archive mr-1"></i>{{ lastBackupFileName }}
                    </div>
                  </div>
                </div>

                <div class="sync-destination-divider"></div>

                <!-- 2. Медиафайлы -->
                <div class="sync-destination-item">
                  <i class="fas fa-images sync-dest-icon"></i>
                  <div class="sync-dest-info">
                    <div class="sync-dest-header">
                      <div class="sync-dest-title-group">
                        <span class="sync-dest-title">Медиафайлы и иллюстрации</span>
                        <span v-if="mediaSyncStatus === 'syncing'" class="badge-status badge-syncing">
                          <i class="fas fa-spinner fa-spin"></i> 4 потока...
                        </span>
                        <span v-else-if="mediaSyncStatus === 'success'" class="badge-status badge-success">
                          <i class="fas fa-check"></i> Загружено
                        </span>
                        <span v-else-if="mediaSyncStatus === 'error'" class="badge-status badge-error">
                          <i class="fas fa-exclamation-triangle"></i> Сбой
                        </span>
                      </div>
                      <code class="sync-dest-path">Приложения/WorldWiki/media/</code>
                    </div>
                    <div class="sync-dest-desc">
                      Инкрементальная параллельная выгрузка (4 потока): загружаются только новые файлы.
                    </div>

                    <!-- Живой прогресс-бар синхронизации файлов -->
                    <div v-if="mediaProgress && mediaProgress.total > 0" class="sync-media-progress-box mt-2">
                      <div class="sync-progress-label flex justify-between text-xs mb-1">
                        <span class="font-medium">
                          Загрузка: {{ mediaProgress.current }} из {{ mediaProgress.total }} файлов
                        </span>
                        <span class="text-accent font-semibold">
                          {{ Math.round((mediaProgress.current / mediaProgress.total) * 100) }}%
                        </span>
                      </div>
                      <div class="sync-progress-track">
                        <div 
                          class="sync-progress-fill" 
                          :style="{ width: `${Math.round((mediaProgress.current / mediaProgress.total) * 100)}%` }"
                        ></div>
                      </div>

                      <!-- Активные параллельные потоки загрузки -->
                      <div v-if="mediaProgress.active_files && mediaProgress.active_files.length > 0" class="sync-active-threads mt-2">
                        <div class="text-xs text-muted mb-1 flex items-center justify-between">
                          <span class="flex items-center gap-1 font-medium text-main">
                            <i class="fas fa-network-wired text-accent"></i>
                            <span>Активные потоки ({{ mediaProgress.active_files.length }}/4):</span>
                          </span>
                        </div>
                        <div class="flex-col gap-1">
                          <div 
                            v-for="fileName in mediaProgress.active_files" 
                            :key="fileName" 
                            class="sync-thread-row text-xs flex items-center justify-between"
                          >
                            <span class="truncate mr-2 text-main">
                              <i class="fas fa-arrow-up text-accent mr-1"></i>
                              {{ fileName }}
                            </span>
                            <span class="badge-uploading">
                              <i class="fas fa-circle-notch fa-spin"></i> выгрузка
                            </span>
                          </div>
                        </div>
                      </div>
                      <div v-else-if="mediaProgress.current_file" class="sync-current-file text-xs text-muted mt-1 truncate">
                        <i class="fas fa-arrow-up text-accent mr-1"></i>
                        <span>{{ mediaProgress.current_file }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex gap-3 items-center justify-center">
                <button 
                  class="btn-sync-primary interactive-el"
                  :disabled="!yandexToken || isSyncing"
                  @click="uploadBackup"
                >
                  <i :class="isSyncing ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'"></i>
                  {{ isSyncing ? 'Синхронизация...' : 'Отправить в облако' }}
                </button>
              </div>
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
} = useCloudSyncModal(emit);

defineExpose({ open: openModal, close });
</script>

<style scoped src="@worldwiki/resources/styles/features/shell/CloudSyncModal.css"></style>
