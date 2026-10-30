<template>
  <Transition name="modal-fade">
  <div v-if="isOpen" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window export-modal">
      <div class="modal-header">
        <h3><i class="fas fa-file-export"></i> Экспорт проекта</h3>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Формат -->
        <div class="form-group">
          <label class="form-label">Формат файла</label>
          <div class="format-chips">
            <button class="chip-btn" :class="{ active: format === 'txt' }" @click="format = 'txt'">
              <i class="fas fa-file-alt"></i> TXT
            </button>
            <button class="chip-btn" :class="{ active: format === 'md' }" @click="format = 'md'">
              <i class="fab fa-markdown"></i> Markdown
            </button>
            <button class="chip-btn" :class="{ active: format === 'fb2' }" @click="format = 'fb2'">
              <i class="fas fa-book"></i> FB2
            </button>
            <button class="chip-btn" :class="{ active: format === 'epub' }" @click="format = 'epub'">
              <i class="fas fa-book-open"></i> EPUB
            </button>
            <button class="chip-btn" :class="{ active: format === 'docx' }" @click="format = 'docx'">
              <i class="fas fa-file-word"></i> DOCX
            </button>
            <button class="chip-btn" :class="{ active: format === 'pdf' }" @click="format = 'pdf'">
              <i class="fas fa-file-pdf"></i> PDF
            </button>
          </div>
        </div>

        <!-- Состав экспорта -->
        <div class="form-group">
          <label class="form-label">Что экспортировать</label>
          <div class="radio-group">
            <label class="radio-label">
              <input v-model="selectionMode" type="radio" value="current">
              <span>Текущую главу</span>
            </label>
            <label class="radio-label">
              <input v-model="selectionMode" type="radio" value="all">
              <span>Все главы книги</span>
            </label>
            <label class="radio-label">
              <input v-model="selectionMode" type="radio" value="selected">
              <span>Выбранные главы...</span>
            </label>
          </div>
        </div>

        <!-- Список глав (если выбран режим selected) -->
        <div v-if="selectionMode === 'selected'" class="chapters-selection-box">
          <div class="selection-actions">
            <button class="btn-link" @click="selectAll">Выбрать все</button>
            <button class="btn-link" @click="clearSelection">Снять всё</button>
          </div>
          <div class="chapters-checklist">
            <label v-for="(c, idx) in allChapters" :key="c.id ?? idx" class="checkbox-label">
              <input v-model="selectedChapters" type="checkbox" :value="c.id">
              <span>{{ c.title || 'Без названия' }}</span>
            </label>
          </div>
        </div>

        <!-- Опции экспорта -->
        <div class="form-group options-box">
          <label class="form-label">Дополнительные опции</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input v-model="addTOC" type="checkbox">
              <span>Создать оглавление</span>
            </label>
            <label class="checkbox-label">
              <input v-model="addPageNumbers" type="checkbox">
              <span>Нумерация страниц (для PDF/DOCX)</span>
            </label>
            <label class="checkbox-label">
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
import type { ExportModalProps, ExportModalEmits } from './ExportModal.model';
import { useExportModal } from './useExportModal';
import type { ExportChapterItem, ExportPayload } from './useExportModal';

const props = withDefaults(defineProps<ExportModalProps>(), {
  allChapters: () => [],
  currentChapterId: null
});

const emit = defineEmits<ExportModalEmits>();

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
} = useExportModal(props, emit as (event: 'close' | 'export', ...args: unknown[]) => void);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ExportModal.css"></style>