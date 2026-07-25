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

        <div class="cloud-sync-body">
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
  uploadBackup
} = useCloudSyncModal(emit);

defineExpose({ open: openModal, close });
</script>

<style scoped src="./CloudSyncModal.vue.css"></style>
