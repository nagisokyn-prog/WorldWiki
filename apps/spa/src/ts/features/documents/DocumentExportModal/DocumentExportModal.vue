<template>
  <div v-if="props.isOpen" class="ww-export-modal-backdrop" @click.self="closeModal">
    <div class="ww-export-modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-export-title">
      <header class="ww-export-modal-header">
        <h3 id="modal-export-title" class="ww-export-modal-title">Экспорт документа</h3>
        <button
          type="button"
          class="btn-icon interactive-el"
          title="Закрыть"
          @click="closeModal"
        >
          ✕
        </button>
      </header>

      <div class="ww-export-modal-body">
        <div class="ww-export-formats-grid">
          <button
            type="button"
            class="ww-export-format-btn"
            :class="{ 'is-selected': selectedFormat === 'docx' }"
            @click="selectedFormat = 'docx'"
          >
            <span class="ww-export-format-name">📄 Word (.docx)</span>
            <span class="ww-export-format-desc">ГОСТ 7.32, шрифты, отступы, сноски</span>
          </button>

          <button
            type="button"
            class="ww-export-format-btn"
            :class="{ 'is-selected': selectedFormat === 'pdf' }"
            @click="selectedFormat = 'pdf'"
          >
            <span class="ww-export-format-name">📑 PDF</span>
            <span class="ww-export-format-desc">Векторная печать высокого разрешения</span>
          </button>

          <button
            type="button"
            class="ww-export-format-btn"
            :class="{ 'is-selected': selectedFormat === 'epub' }"
            @click="selectedFormat = 'epub'"
          >
            <span class="ww-export-format-name">📚 EPUB 3.3</span>
            <span class="ww-export-format-desc">Электронные книги, ридеры, планшеты</span>
          </button>

          <button
            type="button"
            class="ww-export-format-btn"
            :class="{ 'is-selected': selectedFormat === 'fb2' }"
            @click="selectedFormat = 'fb2'"
          >
            <span class="ww-export-format-name">📖 FictionBook (.fb2)</span>
            <span class="ww-export-format-desc">Классический стандарт самиздата и Литрес</span>
          </button>
        </div>

        <div class="ww-export-info-note">
          📁 Экспорт будет сохранен напрямую в системную папку <strong>Загрузки (Downloads)</strong>. Исходный семантический документ в базе данных остается неизменным.
        </div>

        <div v-if="successMessage" class="ww-export-success-banner">
          ✓ {{ successMessage }}
        </div>

        <div v-if="errorMessage" class="error-banner">
          ⚠️ {{ errorMessage }}
        </div>
      </div>

      <footer class="ww-export-modal-footer">
        <button type="button" class="btn-secondary" @click="closeModal">
          Отмена
        </button>
        <button
          type="button"
          class="ww-export-btn-primary"
          :disabled="isExporting"
          @click="handleExport"
        >
          <span v-if="isExporting">Генерация файла...</span>
          <span v-else>Экспортировать</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocumentExportModalEmits, DocumentExportModalProps } from './DocumentExportModal.model';
import { useDocumentExportModal } from './useDocumentExportModal';

const props = defineProps<DocumentExportModalProps>();
const emit = defineEmits<DocumentExportModalEmits>();

const {
  selectedFormat,
  isExporting,
  errorMessage,
  successMessage,
  handleExport,
  closeModal
} = useDocumentExportModal(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/DocumentExportModal.css"></style>
