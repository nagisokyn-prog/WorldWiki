<template>
  <div class="ww-doc-processor">
    <!-- Top Action Bar -->
    <header class="ww-doc-topbar">
      <document-layout-bar
        :editor="editor"
        :initial-mode="'page'"
        :initial-ruler-visible="true"
      />

      <div class="ww-doc-topbar-actions">
        <button
          type="button"
          class="btn-icon interactive-el"
          :title="isInspectorOpen ? 'Скрыть боковую панель' : 'Показать боковую панель'"
          @click="toggleInspector"
        >
          {{ isInspectorOpen ? '⇥' : '⇤' }}
        </button>

        <button
          type="button"
          class="ww-doc-btn-export"
          title="Экспортировать документ в Downloads"
          @click="openExportModal"
        >
          <span>💾</span>
          <span>Экспорт</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="ww-doc-main-container">
      <div class="ww-doc-editor-container">
        <div class="ww-doc-paper-wrapper mode-page">
          <editor-content v-if="editor" :editor="editor" />
        </div>
      </div>

      <!-- Right Academic Inspector Pane -->
      <div class="ww-doc-inspector-pane" :class="{ 'is-collapsed': !isInspectorOpen }">
        <academic-inspector
          v-if="isInspectorOpen"
          :editor="editor"
          :document="semanticDoc"
          :numbering-context="numberingContext"
        />
      </div>
    </main>

    <!-- Export Modal Dialog -->
    <document-export-modal
      :is-open="isExportModalOpen"
      :document="semanticDoc"
      :project-name="props.projectName"
      @close="closeExportModal"
    />
  </div>
</template>

<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3';
import AcademicInspector from '../AcademicInspector/AcademicInspector.vue';
import DocumentExportModal from '../DocumentExportModal/DocumentExportModal.vue';
import DocumentLayoutBar from '../DocumentLayoutBar/DocumentLayoutBar.vue';
import type { DocumentProcessorProps } from './DocumentProcessor.model';
import { useDocumentProcessor } from './useDocumentProcessor';

const props = defineProps<DocumentProcessorProps>();

const {
  editor,
  semanticDoc,
  numberingContext,
  isExportModalOpen,
  isInspectorOpen,
  openExportModal,
  closeExportModal,
  toggleInspector
} = useDocumentProcessor(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/DocumentProcessorView.css"></style>
