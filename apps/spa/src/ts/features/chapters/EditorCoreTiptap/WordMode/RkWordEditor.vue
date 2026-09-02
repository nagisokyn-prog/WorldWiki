<template>
  <div class="rk-word-editor rk-word-editor-container">
    <!-- 1. Наша фирменная лента Word (Microsoft Ribbon Authenticity) -->
    <WordRibbonBar
      :editor="tiptapEditor"
      :commands="ribbonCommands"
      :is-inside-table="isInsideTable"
      @open-paragraph-dialog="isParagraphModalOpen = true"
      @open-page-setup="isPageSetupOpen = true"
      @open-header-footer-dialog="openHeaderFooterDialog"
    />

    <!-- 2. Фиксированная верхняя линейка Word с динамической шириной -->
    <div class="rk-ruler-sticky-bar">
      <WordRuler
        :page-size="pageSize"
        :is-landscape="isLandscape"
        :editor="tiptapEditor"
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
          <i class="fas fa-file-alt"></i> Страниц: {{ pageCount }}
        </span>
        <span class="rk-status-item">
          Слов: {{ wordCount }}
        </span>
        <span class="rk-status-item">
          Знаков: {{ characterCount }}
        </span>
      </div>

      <div class="rk-status-right">
        <!-- Кнопка быстрой смены ориентации (Книжная / Альбомная) -->
        <button
          type="button"
          class="rk-status-btn"
          :class="{ 'is-active': isLandscape }"
          :title="isLandscape ? 'Переключить в книжную ориентацию' : 'Переключить в альбомную ориентацию'"
          @click="toggleOrientation"
        >
          <i :class="isLandscape ? 'fas fa-arrows-alt-h' : 'fas fa-arrows-alt-v'"></i>
          <span>{{ isLandscape ? 'Альбомная (Landscape)' : 'Книжная (Portrait)' }}</span>
        </button>

        <!-- Выбор формата листа (А4 / А5 / А3) -->
        <span class="rk-status-item">
          Формат: <b>{{ pageSize }}</b>
        </span>

        <!-- Масштаб -->
        <span class="rk-status-item">
          100%
        </span>
      </div>
    </div>

    <!-- Модальное окно параметров абзаца по ГОСТ -->
    <ParagraphFormatModal
      :is-open="isParagraphModalOpen"
      @close="isParagraphModalOpen = false"
      @apply="handleParagraphFormatApply"
    />

    <!-- Диалоги Word-режима -->
    <PageSetupModal
      :is-open="isPageSetupOpen"
      :margins="currentMarginsMm"
      :page-size="pageSize"
      :orientation="orientation"
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
import '@raazkhnl/rk-editor-ui/styles.css';
import { useRkWordEditor } from './useRkWordEditor';
import type { RkWordEditorProps, RkWordEditorEmits } from './RkWordEditor.model';
import WordRibbonBar from '../WordRibbonBar/WordRibbonBar.vue';
import WordRuler from '../WordRuler/WordRuler.vue';
import ParagraphFormatModal, { type ParagraphFormatData } from '../ParagraphFormatModal/ParagraphFormatModal.vue';
import PageSetupModal from '../PageSetupModal/PageSetupModal.vue';
import HeaderFooterDialog from '../HeaderFooterDialog/HeaderFooterDialog.vue';
import ImageInsertDialog from '../ImageInsertDialog/ImageInsertDialog.vue';
import TablePickerPopup from '../TablePickerPopup/TablePickerPopup.vue';
import LinkInsertDialog from '../LinkInsertDialog/LinkInsertDialog.vue';
import EquationInsertDialog from '../EquationInsertDialog/EquationInsertDialog.vue';

const props = defineProps<RkWordEditorProps>();
const emit = defineEmits<RkWordEditorEmits>();

const editorHostRef = ref<HTMLElement | null>(null);
const isParagraphModalOpen = ref(false);

// Диалоги Word-режима
const isPageSetupOpen = ref(false);
const isHeaderFooterOpen = ref(false);
const headerFooterTab = ref<'header' | 'footer'>('header');
const isImageDialogOpen = ref(false);
const isTablePickerOpen = ref(false);
const isLinkDialogOpen = ref(false);
const isEquationDialogOpen = ref(false);

const {
  wordEditor,
  tiptapEditor,
  orientation,
  pageSize,
  pageCount,
  wordCount,
  characterCount,
  isLandscape,
  isInsideTable,
  currentMarginsMm,
  toggleOrientation,
  setOrientation,
  setPageSize,
  ribbonCommands,
} = useRkWordEditor(editorHostRef, props, emit);

/**
 * rk-editor-core поддерживает только `indent` attr для абзацев:
 * margin-left = indent * 40px, step ≈ 1.058 см.
 * Конвертируем см → уровень и вызываем updateAttributes.
 */
const PX_PER_CM = 37.82;
const INDENT_STEP_PX = 40;

const handleScrollAreaClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    wordEditor.value?.focus();
  }
};

// Красная строка: используем `firstLineIndent` attr из `paragraphSystem` extension.
// Если 0 — ставим '0' явно, чтобы перебить CSS-дефолт 1.25cm.
const handleFirstLineIndent = (cm: number) => {
  if (!tiptapEditor.value) return;
  const val = cm <= 0 ? '0' : `${cm.toFixed(3)}cm`;
  tiptapEditor.value.chain().focus().updateAttributes('paragraph', { firstLineIndent: val }).run();
};

// Левый отступ абзаца через `indent` attr (единственный в схеме rk-editor-core)
const handleLeftIndent = (cm: number) => {
  if (!tiptapEditor.value) return;
  const level = Math.round((cm * PX_PER_CM) / INDENT_STEP_PX);
  const clamped = Math.max(0, Math.min(8, level));
  tiptapEditor.value.chain().focus().updateAttributes('paragraph', { indent: clamped }).run();
};

// Правый отступ не поддерживается схемой rk-editor-core — no-op
const handleRightIndent = (_cm: number) => {
  // no-op
};

const handleParagraphFormatApply = (data: ParagraphFormatData) => {
  if (wordEditor.value) {
    wordEditor.value.commands.align(data.alignment);
    wordEditor.value.commands.lineHeight(data.lineHeight);
    if (data.firstLineType === 'indent') {
      wordEditor.value.commands.indent();
    }
  }
  isParagraphModalOpen.value = false;
};

/* ── Диалоги Word-режима ── */

const openHeaderFooterDialog = (tab?: 'header' | 'footer') => {
  headerFooterTab.value = tab || 'header';
  isHeaderFooterOpen.value = true;
};

/** Значения полей колонтитулов для повторного открытия диалога (plain text) */
const dialogHeader = ref({ left: props.chapterTitle || '', center: '', right: '' });
const dialogFooter = ref({ left: '', center: '', right: 'Стр. {page} из {total}' });

const handleHeaderFooterApply = (payload: {
  header: { left: string; center: string; right: string };
  footer: { left: string; center: string; right: string };
}) => {
  const cell = (text: string, align: string) => `<td align='${align}'>${text}</td>`;
  const wrap = (left: string, center: string, right: string) =>
    `<table style='width:100%'><tr>${cell(left, 'left')}${cell(center, 'center')}${cell(right, 'right')}</tr></table>`;
  ribbonCommands.value.updateHeaderText?.(wrap(payload.header.left, payload.header.center, payload.header.right), '');
  ribbonCommands.value.updateFooterText?.(wrap(payload.footer.left, payload.footer.center, payload.footer.right), '');
  dialogHeader.value = { ...payload.header };
  dialogFooter.value = { ...payload.footer };
};

const handlePageSetupApply = (payload: { margins: { top: number; bottom: number; left: number; right: number }; pageSize: 'A4' | 'A5' | 'A3' | 'Letter' | 'B5' | 'Legal' | 'Tabloid' | 'Custom'; orientation: 'portrait' | 'landscape' }) => {
  ribbonCommands.value.setCustomMargins?.(payload.margins.top, payload.margins.bottom, payload.margins.left, payload.margins.right);
  if (payload.pageSize !== pageSize.value) setPageSize(payload.pageSize);
  if (payload.orientation !== orientation.value) setOrientation(payload.orientation);
};

const handleImageInsert = (payload: { src: string; caption: string; align: 'block' | 'left' | 'right' }) => {
  ribbonCommands.value.insertImageWithCaption?.(payload.src, payload.caption);
  // Выравнивание применяется к последнему вставленному изображению атрибутом textAlign
  if (payload.align !== 'block' && tiptapEditor.value) {
    tiptapEditor.value.chain().focus().updateAttributes('image', { textAlign: payload.align }).run();
  }
};

const handleTableInsert = (payload: { rows: number; cols: number }) => {
  ribbonCommands.value.insertTableWithCaption?.(payload.rows, payload.cols);
};

const handleLinkInsert = (payload: { url: string; text: string }) => {
  // Подпись ссылки (text) не поддерживается CommandManager.insertLink — вставляем URL
  void payload.text;
  ribbonCommands.value.insertLinkUrl?.(payload.url);
};

const handleEquationInsert = (payload: { latex: string }) => {
  ribbonCommands.value.insertEquationLatex?.(payload.latex);
};
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/RkWordEditor.css"></style>
