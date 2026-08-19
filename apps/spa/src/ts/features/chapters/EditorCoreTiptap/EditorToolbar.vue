<template>
  <div class="editor-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; gap: 8px;">
    <!-- LEFT: Switch Mode & Formatting Actions -->
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <XboxWheel 
        :model-value="editorMode" 
        :options="modeOptions"
        @update:model-value="$emit('update:editorMode', $event)" 
      />

      <div v-if="editorMode === 'wysiwyg' || editorMode === 'split'" class="toolbar-actions" style="display: flex; gap: 4px; border-left: 1px solid var(--border-color); padding-left: 8px;">
        <button class="btn btn-icon interactive-el toolbar-btn" title="Жирный (Ctrl+B)" @click="commands.toggleBold?.()"><b>B</b></button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Курсив (Ctrl+I)" @click="commands.toggleItalic?.()"><i>I</i></button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Зачеркнутый" @click="commands.toggleStrike?.()"><s>S</s></button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Заголовок 1" @click="commands.setHeading?.(1)">H1</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Заголовок 2" @click="commands.setHeading?.(2)">H2</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Цитата" @click="commands.toggleBlockquote?.()">”</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Маркированный список" @click="commands.toggleBulletList?.()">• List</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Нумерованный список" @click="commands.toggleOrderedList?.()">1. List</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Вставить изображение" @click="commands.insertImage?.()">🖼️</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Вставить таблицу" @click="commands.insertTable?.()">📊</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Вставить ссылку" @click="commands.insertLink?.()">🔗</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Очистить форматирование" @click="commands.clearFormatting?.()">🧹</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Добавить сноску" @click="commands.insertFootnote?.()">📝 [^1]</button>
      </div>
    </div>

    <!-- RIGHT: Save / Actions -->
    <div style="display: flex; align-items: center; gap: 8px;">
      <button 
        v-if="settings?.editor?.requireCtrlForLinks" 
        class="btn btn-small btn-outline interactive-el" 
        style="font-size: 11px;"
        title="Требовать Ctrl для перехода по ссылкам (включено в настройках)"
        @click="commands.toggleLinkLock?.()"
      >
        🔒 Ctrl+Link
      </button>
      <button class="btn btn-small btn-outline interactive-el" title="История изменений главы" @click="$emit('toggle-history')">
        <i class="fas fa-history"></i>
      </button>
      <button class="btn btn-small btn-outline interactive-el" title="Анализ текста" @click="commands.analyzeText?.()">
        <i class="fas fa-chart-bar"></i>
      </button>
      <button 
        class="btn btn-small btn-primary interactive-el" 
        :disabled="!hasUnsavedChanges"
        @click="$emit('save')"
      >
        <i class="fas fa-save"></i> {{ hasUnsavedChanges ? 'Сохранить*' : 'Сохранено' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { Editor } from '@tiptap/vue-3';
import type { AppSettings } from '@worldwiki/components';

export interface EditorModeOption {
  value: string;
  label: string;
}

export interface EditorCommands {
  toggleBold?: () => boolean | undefined;
  toggleItalic?: () => boolean | undefined;
  toggleStrike?: () => boolean | undefined;
  setHeading?: (level: number) => boolean | undefined;
  toggleBlockquote?: () => boolean | undefined;
  toggleBulletList?: () => boolean | undefined;
  toggleOrderedList?: () => boolean | undefined;
  insertImage?: () => void;
  insertTable?: () => void;
  insertLink?: () => void;
  clearFormatting?: () => void;
  insertFootnote?: () => void;
  toggleLinkLock?: () => void;
  analyzeText?: () => void;
  [key: string]: unknown;
}

defineProps<{
  editor: Editor | null | undefined;
  editorMode: string;
  modeOptions: EditorModeOption[];
  hasUnsavedChanges: boolean;
  settings: AppSettings | null;
  commands: EditorCommands;
}>();

defineEmits(['update:editorMode', 'save', 'toggle-history']);
</script>

<style scoped>
.toolbar-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-main);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.toolbar-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-color);
}
</style>
