<template>
  <div class="entity-editor-window">
    <!-- Header -->
    <header class="window-header">
      <div class="entity-info">
        <span class="entity-type-badge">{{ props.entityType }}</span>
        <span class="entity-name">{{ (initialData?.name as string) || 'Загрузка...' }}</span>
        <span class="entity-id-text">#{{ props.entityId }}</span>
      </div>
      <div class="header-actions">
        <button
          v-if="isPreviewingHistory"
          class="btn-return-current"
          @click="exitHistoryPreview"
        >
          Вернуться к текущей
        </button>
        <button
          class="save-btn"
          :class="{ 'unsaved': isUnsaved }"
          :disabled="isPreviewingHistory"
          @click="save"
        >
          <i class="fas fa-save"></i>
          {{ isUnsaved ? 'Сохранить изменения' : 'Сохранено' }}
        </button>
        <button
          class="btn-history-toggle"
          title="История изменений"
          @click="toggleHistory"
        >
          <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M7 8l0 8"></path>
            <path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path>
            <path d="M14 14l3 -3l3 3"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- History preview warning banner -->
    <div v-if="isPreviewingHistory" class="history-preview-banner">
      <span class="preview-warning-text">⚠️ ВЫ ПРОСМАТРИВАЕТЕ СТАРУЮ ВЕРСИЮ</span>
      <div class="banner-buttons">
        <button class="btn-cancel" @click="exitHistoryPreview">Отмена</button>
        <button class="btn-restore" @click="restoreHistory">Восстановить эту версию</button>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="editor-workspace">
      <div class="editor-main-area">
        <EntityEditor
          v-if="props.entityId && props.entityType && props.project && !isLoadingData"
          :key="previewKey"
          ref="editorRef"
          :entity-id="props.entityId"
          :entity-type="props.entityType"
          :project="props.project"
          :initial-data="(previewData || initialData) as Record<string, unknown>"
          @modified="isUnsaved = true"
          @saved="isUnsaved = false"
          @update-data="handleUpdateData"
        />

        <div v-else-if="isLoadingData" class="loading-state">
          <i class="fas fa-spinner fa-spin loading-spinner"></i>
          <span>Загрузка данных...</span>
        </div>
      </div>

      <!-- History Aside Sidebar -->
      <aside v-if="showHistory" class="history-sidebar">
        <div class="sidebar-header">
          <span>История изменений</span>
          <button class="btn-close-sidebar" @click="showHistory = false">✕</button>
        </div>

        <div v-if="isLoadingHistory" class="history-loading">
          Загрузка истории...
        </div>
        <div v-else class="history-list">
          <div v-if="revisions.length === 0" class="history-empty">
            Нет сохраненных версий
          </div>

          <div
            v-for="rev in revisions"
            :key="rev.id"
            class="history-item"
            :class="{ 'active': previewingRevId === rev.id }"
            @click="previewHistory(rev)"
          >
            <div class="history-item-row">
              <span class="history-date">{{ rev.formattedDate }}</span>
            </div>
            <div v-if="previewingRevId === rev.id" class="history-preview-badge">
              <span>Режим предпросмотра</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import EntityEditor from '../EntityEditor/EntityEditor.vue';
import type { EntityEditorWindowProps } from './EntityEditorWindow.model';
import { useEntityEditorWindow } from './useEntityEditorWindow';

const props = defineProps<EntityEditorWindowProps>();

const {
  isLoadingData,
  initialData,
  isUnsaved,
  editorRef,
  showHistory,
  isLoadingHistory,
  revisions,
  isPreviewingHistory,
  previewingRevId,
  previewData,
  previewKey,
  toggleHistory,
  previewHistory,
  exitHistoryPreview,
  restoreHistory,
  save,
  handleUpdateData,
} = useEntityEditorWindow(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/EntityEditorWindow.css"></style>

