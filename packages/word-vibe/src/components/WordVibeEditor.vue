<template>
  <div class="rk-word-editor rk-word-editor-container">
    <!-- 1. Фирменная лента Word (Microsoft Ribbon) -->
    <WordRibbonBar
      :commands="ribbonCommands"
      :is-inside-table="selection.isInsideTable"
      @open-paragraph-dialog="isParagraphModalOpen = true"
      @open-page-setup="isPageSetupOpen = true"
      @open-header-footer-dialog="openHeaderFooterDialog"
    />

    <!-- 2. Фиксированная верхняя линейка Word с динамической шириной -->
    <div class="rk-ruler-sticky-bar">
      <WordRuler
        :page-size="currentLayout.pageSize"
        :is-landscape="currentLayout.orientation === 'landscape'"
        :first-line-indent-cm="selection.firstLineIndentCm"
        :left-indent-cm="selection.leftIndentCm"
        @update:first-line-indent="handleFirstLineIndent"
        @update:left-indent="handleLeftIndent"
        @update:right-indent="handleRightIndent"
      />
    </div>

    <!-- 3. Скроллируемая область виртуальных страниц RK Word Editor -->
    <div class="rk-editor-scroll-area" @click="handleScrollAreaClick">
      <div ref="editorHostRef" class="rk-editor-mount"></div>
    </div>

    <!-- 4. Нижняя строка состояния (Status Bar) -->
    <div class="rk-editor-status-bar">
      <div class="rk-status-left">
        <span class="rk-status-item">
          <i class="fas fa-file-alt"></i> Страниц: {{ currentStats.pageCount }}
        </span>
        <span class="rk-status-item">
          Слов: {{ currentStats.wordCount }}
        </span>
        <span class="rk-status-item">
          Знаков: {{ currentStats.characterCount }}
        </span>
      </div>

      <div class="rk-status-right">
        <!-- Кнопка быстрой смены ориентации (Книжная / Альбомная) -->
        <button
          type="button"
          class="rk-status-btn"
          :class="{ 'is-active': currentLayout.orientation === 'landscape' }"
          :title="currentLayout.orientation === 'landscape' ? 'Переключить в книжную ориентацию' : 'Переключить в альбомную ориентацию'"
          @click="adapter.execCommand('togglePageOrientation')"
        >
          <i :class="currentLayout.orientation === 'landscape' ? 'fas fa-arrows-alt-h' : 'fas fa-arrows-alt-v'"></i>
          <span>{{ currentLayout.orientation === 'landscape' ? 'Альбомная (Landscape)' : 'Книжная (Portrait)' }}</span>
        </button>

        <!-- Выбор формата листа (А4 / А5 / А3) -->
        <span class="rk-status-item">
          Формат: <b>{{ currentLayout.pageSize }}</b>
        </span>

        <!-- Масштаб -->
        <span class="rk-status-item">
          100%
        </span>
      </div>
    </div>

    <!-- Модальные окна Word-режима -->
    <ParagraphFormatModal
      :is-open="isParagraphModalOpen"
      @close="isParagraphModalOpen = false"
      @apply="handleParagraphFormatApply"
    />

    <PageSetupModal
      :is-open="isPageSetupOpen"
      :margins="currentLayout.marginsMm"
      :page-size="currentLayout.pageSize"
      :orientation="currentLayout.orientation"
      @close="isPageSetupOpen = false"
      @apply="handlePageSetupApply"
    />

    <HeaderFooterDialog
      :is-open="isHeaderFooterOpen"
      :initial-tab="headerFooterTab"
      :header="dialogHeader"
      :footer="dialogFooter"
      @close="isHeaderFooterOpen = false"
      @apply="handleHeaderFooterApply"
    />

    <ImageInsertDialog
      :is-open="isImageDialogOpen"
      @close="isImageDialogOpen = false"
      @insert="handleImageInsert"
    />

    <TablePickerPopup
      :is-open="isTablePickerOpen"
      @close="isTablePickerOpen = false"
      @insert="handleTableInsert"
    />

    <LinkInsertDialog
      :is-open="isLinkDialogOpen"
      @close="isLinkDialogOpen = false"
      @insert="handleLinkInsert"
    />

    <EquationInsertDialog
      :is-open="isEquationDialogOpen"
      @close="isEquationDialogOpen = false"
      @insert="handleEquationInsert"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { WordVibeEditorProps, WordVibeEditorEmits } from './WordVibeEditor.model';
import { useWordVibeEditor } from './useWordVibeEditor';
import WordRibbonBar from './ribbon/WordRibbonBar.vue';
import WordRuler from './ruler/WordRuler.vue';
import ParagraphFormatModal from './modals/ParagraphFormatModal/ParagraphFormatModal.vue';
import PageSetupModal from './modals/PageSetupModal/PageSetupModal.vue';
import HeaderFooterDialog from './modals/HeaderFooterDialog/HeaderFooterDialog.vue';
import ImageInsertDialog from './modals/ImageInsertDialog/ImageInsertDialog.vue';
import TablePickerPopup from './modals/TablePickerPopup/TablePickerPopup.vue';
import LinkInsertDialog from './modals/LinkInsertDialog/LinkInsertDialog.vue';
import EquationInsertDialog from './modals/EquationInsertDialog/EquationInsertDialog.vue';
import { GOST_MARGINS_MM } from '../editor/geometryHelper';

const props = withDefaults(defineProps<WordVibeEditorProps>(), {
  content: '<p></p>',
  pageSize: 'A4',
  orientation: 'portrait',
  isReadOnly: false,
  margins: () => ({ ...GOST_MARGINS_MM }),
  chapterTitle: '',
});

const emit = defineEmits<WordVibeEditorEmits>();
const editorHostRef = ref<HTMLElement | null>(null);

const {
  adapter,
  currentLayout,
  currentStats,
  selection,
  dialogHeader,
  dialogFooter,
  isParagraphModalOpen,
  isPageSetupOpen,
  isHeaderFooterOpen,
  headerFooterTab,
  isImageDialogOpen,
  isTablePickerOpen,
  isLinkDialogOpen,
  isEquationDialogOpen,
  ribbonCommands,
  openHeaderFooterDialog,
  handleScrollAreaClick,
  handleFirstLineIndent,
  handleLeftIndent,
  handleRightIndent,
  handleParagraphFormatApply,
  handleHeaderFooterApply,
  handlePageSetupApply,
  handleImageInsert,
  handleTableInsert,
  handleLinkInsert,
  handleEquationInsert,
} = useWordVibeEditor(editorHostRef, props, emit);

defineExpose({
  adapter,
});
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/RkWordEditor.css"></style>
