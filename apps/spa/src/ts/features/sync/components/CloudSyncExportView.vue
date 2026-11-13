<template>
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

  <div class="flex gap-3 items-center justify-center flex-wrap">
    <button
      class="btn-sync-primary interactive-el"
      :disabled="!yandexToken || isSyncing"
      @click="$emit('upload')"
    >
      <i :class="isSyncing ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'"></i>
      {{ isSyncing ? 'Синхронизация...' : 'Отправить в облако' }}
    </button>
    <button
      type="button"
      class="btn btn-secondary interactive-el"
      :disabled="isSyncing"
      title="Создать локальный бэкап .wwiki"
      @click="$emit('exportLocal')"
    >
      <i class="far fa-file-archive mr-1"></i> Сохранить файл .wwiki
    </button>
  </div>
</template>

<script setup lang="ts">
import type { DatabaseSyncStatus, MediaSyncProgress, MediaSyncStatus } from '../CloudSyncModal.model';

defineProps<{
  yandexToken: string | null;
  isSyncing: boolean;
  dbSyncStatus: DatabaseSyncStatus;
  mediaSyncStatus: MediaSyncStatus;
  mediaProgress: MediaSyncProgress | null;
  lastBackupFileName: string;
}>();

defineEmits<{
  upload: [];
  exportLocal: [];
}>();
</script>

