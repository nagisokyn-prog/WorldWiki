<template>
  <div class="rk-word-editor rk-word-editor-container">
    <!-- 1. Наша фирменная лента Word (Microsoft Ribbon Authenticity) -->
    <WordRibbonBar
      :editor="tiptapEditor"
      :commands="ribbonCommands"
      @open-paragraph-dialog="isParagraphModalOpen = true"
    />

    <!-- 2. Фиксированная верхняя линейка Word с динамической шириной -->
    <div class="rk-ruler-sticky-bar">
      <WordRuler
        :page-size="pageSize"
        :is-landscape="isLandscape"
        :editor="tiptapEditor"
        @update:first-line-indent="handleFirstLineIndent"
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

const props = defineProps<RkWordEditorProps>();
const emit = defineEmits<RkWordEditorEmits>();

const editorHostRef = ref<HTMLElement | null>(null);
const isParagraphModalOpen = ref(false);

const {
  wordEditor,
  tiptapEditor,
  pageSize,
  pageCount,
  wordCount,
  characterCount,
  isLandscape,
  toggleOrientation,
  ribbonCommands,
} = useRkWordEditor(editorHostRef, props, emit);

const handleScrollAreaClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    wordEditor.value?.focus();
  }
};

const handleFirstLineIndent = (_cm: number) => {
  if (tiptapEditor.value) {
    tiptapEditor.value.chain().focus().run();
  }
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
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/RkWordEditor.css"></style>
