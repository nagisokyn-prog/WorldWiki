<template>
  <Transition name="fade">
  <div v-if="isOpen" class="modal" style="display: flex;">
    <div v-motion-pop class="modal-content">
      <div class="modal-header">
        <h2>Экспорт глав</h2>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="export-section">
          <h3>Формат файла</h3>
          <div class="format-grid">
            <label class="format-option">
              <input v-model="format" type="radio" value="txt">
              <div class="format-icon"><i class="fas fa-file-alt"></i></div>
              <span>TXT</span><small>Текст</small>
            </label>
            <label class="format-option">
              <input v-model="format" type="radio" value="docx">
              <div class="format-icon"><i class="fas fa-file-word"></i></div>
              <span>DOCX</span><small>Word</small>
            </label>
            <label class="format-option">
              <input v-model="format" type="radio" value="pdf">
              <div class="format-icon"><i class="fas fa-file-pdf"></i></div>
              <span>PDF</span><small>Документ</small>
            </label>
          </div>
        </div>

        <div class="export-section">
          <h3>Главы для экспорта</h3>
          <div class="chapters-selection">
            <label class="selection-option">
              <input v-model="selectionMode" type="radio" value="current">
              <span>Текущая глава</span>
            </label>
            <label class="selection-option">
              <input v-model="selectionMode" type="radio" value="all">
              <span>Все главы</span>
            </label>
            <label class="selection-option">
              <input v-model="selectionMode" type="radio" value="selected">
              <span>Выбрать главы</span>
            </label>
          </div>
          
          <div v-if="selectionMode === 'selected'" style="margin-top: 20px;">
            <div class="chapters-dropdown-container" style="position: relative;">
              <div class="chapters-dropdown export-black" style="display: block;">
                <div class="dropdown-controls" style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                  <div class="selected-count" style="font-size: 12px; color: #666;">
                    Выбрано: {{ selectedChapters.length }} глав
                  </div>
                  <div class="control-buttons" style="display: flex; gap: 8px;">
                    <button class="small-btn" style="padding: 4px 8px; font-size: 12px;" @click="selectAll">
                      <i class="fas fa-check-double"></i> Все
                    </button>
                    <button class="small-btn" style="padding: 4px 8px; font-size: 12px;" @click="clearSelection">
                      <i class="fas fa-times"></i> Очистить
                    </button>
                  </div>
                </div>
                <div class="chapters-list" style="max-height: 200px; overflow-y: auto; padding: 10px;">
                  <div v-for="ch in allChapters" :key="ch.id" style="margin-bottom: 5px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                      <input v-model="selectedChapters" type="checkbox" :value="ch.id">
                      {{ ch.title || 'Без названия' }}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="export-section">
          <h3>Дополнительно</h3>
          <div class="export-options">
            <label class="option-checkbox">
              <input v-model="addTOC" type="checkbox">
              <span>Добавить оглавление</span>
            </label>
            <label class="option-checkbox">
              <input v-model="addPageNumbers" type="checkbox">
              <span>Нумерация страниц</span>
            </label>
            <label class="option-checkbox">
              <input v-model="includeMetadata" type="checkbox">
              <span>Включить метаданные</span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Отмена</button>
        <button class="btn btn-primary" :disabled="loading" @click="exportData">
          {{ loading ? 'Экспорт...' : 'Экспортировать' }}
        </button>
      </div>
    </div>
  </div>
  </Transition>
</template>

<script setup lang="ts">
import { useExportModal } from './useExportModal';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  allChapters: { type: Array as () => any[], default: () => [] },
  currentChapterId: { type: String, default: null }
});

const emit = defineEmits(['close', 'export']);

const {
  format,
  selectionMode,
  selectedChapters,
  addTOC,
  addPageNumbers,
  includeMetadata,
  loading,
  selectAll,
  clearSelection,
  exportData
} = useExportModal(props, emit);
</script>

<style scoped src="./ExportModal.vue.css"></style>