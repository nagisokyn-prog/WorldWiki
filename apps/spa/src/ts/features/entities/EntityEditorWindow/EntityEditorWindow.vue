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

<style scoped>
.entity-editor-window {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-window, #09090b);
  color: var(--text-main, #ffffff);
}

.window-header {
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(10px);
  -webkit-app-region: drag;
}

.window-header button {
  -webkit-app-region: no-drag;
}

.entity-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.entity-type-badge {
  background: var(--accent, #8b5cf6);
  color: var(--text-on-accent, #ffffff);
  padding: 2px 8px;
  border-radius: var(--radius-sm, 4px);
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.entity-name {
  font-weight: 600;
  font-size: 15px;
}

.entity-id-text {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  font-size: 12px;
  font-family: monospace;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-return-current {
  background: rgba(245, 166, 35, 0.1);
  color: var(--warning, #f5a623);
  border: 1px solid rgba(245, 166, 35, 0.3);
  padding: 8px 12px;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
}

.save-btn {
  background: var(--accent, #8b5cf6);
  color: var(--text-on-accent, #ffffff);
  border: none;
  padding: 8px 18px;
  border-radius: var(--radius-md, 8px);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px var(--accent-glow, rgba(139, 92, 246, 0.3));
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--accent-hover, #7c3aed);
}

.save-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn.unsaved {
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
}

.btn-history-toggle {
  background: var(--bg-input, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  color: var(--text-main, #ffffff);
  padding: 8px;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
}

.history-preview-banner {
  background: rgba(245, 166, 35, 0.1);
  border-bottom: 1px solid rgba(245, 166, 35, 0.3);
  padding: 8px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.preview-warning-text {
  font-size: 11px;
  color: var(--warning, #f5a623);
  font-weight: bold;
}

.banner-buttons {
  display: flex;
  gap: 8px;
}

.btn-cancel {
  font-size: 10px;
  border: 1px solid rgba(245, 166, 35, 0.3);
  background: transparent;
  color: var(--warning, #f5a623);
  padding: 4px 8px;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
}

.btn-restore {
  font-size: 10px;
  background: var(--warning, #f5a623);
  color: #000000;
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-weight: bold;
}

.editor-workspace {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.editor-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  gap: 16px;
}

.loading-spinner {
  font-size: 24px;
}

.history-sidebar {
  width: 280px;
  background: var(--bg-panel, #18181b);
  border-left: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  box-shadow: -5px 0 20px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  font-size: 12px;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-close-sidebar {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

.history-loading {
  padding: 20px;
  text-align: center;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  font-size: 12px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-empty {
  font-size: 10px;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  text-align: center;
}

.history-item {
  padding: 10px 12px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-input, rgba(255, 255, 255, 0.05));
}

.history-item.active {
  background: rgba(139, 92, 246, 0.1);
  border-color: var(--accent, #8b5cf6);
}

.history-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-date {
  font-size: 11px;
  font-weight: bold;
}

.history-preview-badge {
  margin-top: 8px;
  font-size: 9px;
  color: var(--warning, #f5a623);
}
</style>

