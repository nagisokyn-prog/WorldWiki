<template>
  <div class="ww-layout-bar">
    <div class="ww-layout-bar-group">
      <div class="ww-layout-segmented-control" role="group" aria-label="Режим отображения документа">
        <button
          type="button"
          class="ww-layout-segmented-btn"
          :class="{ 'is-active': isPageMode }"
          title="Страничный вид (А4 / ГОСТ с физическими разрывами страниц)"
          @click="setMode('page')"
        >
          <span>📄</span>
          <span>Страничный вид</span>
        </button>
        <button
          type="button"
          class="ww-layout-segmented-btn"
          :class="{ 'is-active': !isPageMode }"
          title="Свободный холст (непрерывный текст без разрывов)"
          @click="setMode('canvas')"
        >
          <span>✍️</span>
          <span>Холст</span>
        </button>
      </div>

      <button
        type="button"
        class="ww-layout-ruler-btn interactive-el"
        :class="{ 'is-active': isRulerVisible }"
        title="Показать / скрыть линейку полей и отступов"
        @click="toggleRuler"
      >
        <span>📏</span>
        <span>Линейка</span>
      </button>
    </div>

    <div class="ww-layout-bar-group">
      <span class="ww-layout-page-info">
        {{ isPageMode ? 'А4 (ГОСТ 7.32)' : 'Непрерывный холст' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocumentLayoutBarProps } from './DocumentLayoutBar.model';
import { useDocumentLayoutBar } from './useDocumentLayoutBar';

const props = defineProps<DocumentLayoutBarProps>();

const {
  isPageMode,
  isRulerVisible,
  setMode,
  toggleRuler
} = useDocumentLayoutBar(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/documents/DocumentLayoutBar.css"></style>
