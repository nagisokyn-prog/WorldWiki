<template>
  <div class="status-bar">
    <div class="flex gap-4">
      <span>Слов: {{ wordCount }}</span>
      <span>Символов: {{ charCount }}</span>
      <span v-if="editorMode === 'split'">Блоков: {{ blockCount }}</span>
      <span class="opacity-70 ml-4">
        Shift+Enter для переноса | 
        <span v-if="editorMode === 'split'">Ctrl+R скрыть структуру</span>
      </span>
    </div>
    <div>
      <span class="text-accent font-bold">
        <i class="fas fa-lock mr-1"></i>
        Зажмите Ctrl для перехода по ссылкам
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorStatusBarProps } from './EditorStatusBar.model';
defineProps<EditorStatusBarProps>();
</script>
