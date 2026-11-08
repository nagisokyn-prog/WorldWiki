<template>
  <div class="status-bar">
    <div class="flex gap-4">
      <span>Слов: {{ wordCount }}</span>
      <span>Символов: {{ charCount }}</span>
      <span v-if="editorMode === 'split'">Блоков: {{ blockCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EditorStatusBarProps } from './EditorStatusBar.model';
defineProps<EditorStatusBarProps>();
</script>
