<template>
  <div class="editor-header">
    <!-- LEFT: Switch Mode & Title & Formatting Actions -->
    <div class="toolbar-left-group">
      <XboxWheel 
        :model-value="editorMode" 
        :options="modeOptions"
        @update:model-value="$emit('update:editorMode', $event)" 
      />

      <!-- Title inside editor-header to the right of dropdown-container -->
      <div class="chapter-header-inline">
        <div v-if="changedFields?.includes('title')" class="changed-indicator changed-indicator-title" title="Поле было изменено">
          <span class="badge badge-accent">Изменено</span>
        </div>
        <input 
          type="text" 
          :value="title" 
          placeholder="Название главы..." 
          class="chapter-title-input-inline" 
          @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
        >
      </div>

      <!-- Formatting Actions ONLY for wysiwyg and split (Word has its own Ribbon) -->
      <div v-if="editorMode === 'wysiwyg' || editorMode === 'split'" class="toolbar-actions">
        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('bold') }" title="Жирный (Ctrl+B)" @click="commands.toggleBold?.()"><b>B</b></button>
        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('italic') }" title="Курсив (Ctrl+I)" @click="commands.toggleItalic?.()"><i>I</i></button>
        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('strike') }" title="Зачеркнутый" @click="commands.toggleStrike?.()"><s>S</s></button>

        <span class="toolbar-divider"></span>

        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('heading', { level: 1 }) }" title="Заголовок 1" @click="commands.setHeading?.(1)">H1</button>
        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('heading', { level: 2 }) }" title="Заголовок 2" @click="commands.setHeading?.(2)">H2</button>

        <span class="toolbar-divider"></span>

        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('blockquote') }" title="Цитата" @click="commands.toggleBlockquote?.()">”</button>
        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('bulletList') }" title="Маркированный список" @click="commands.toggleBulletList?.()">• List</button>
        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('orderedList') }" title="Нумерованный список" @click="commands.toggleOrderedList?.()">1. List</button>

        <span class="toolbar-divider"></span>

        <button class="btn btn-icon interactive-el toolbar-btn" title="Вставить изображение" @click="commands.insertImage?.()">🖼️</button>
        <button class="btn btn-icon interactive-el toolbar-btn" title="Вставить таблицу" @click="commands.insertTable?.()">📊</button>
        <button class="btn btn-icon interactive-el toolbar-btn" :class="{ 'is-active': editor?.isActive?.('link') }" title="Вставить ссылку" @click="commands.insertLink?.()">🔗</button>
        <button class="btn btn-icon interactive-el toolbar-btn toolbar-btn-danger" title="Очистить форматирование" @click="commands.clearFormatting?.()">🧹</button>
      </div>
    </div>

    <!-- RIGHT: Save / Actions -->
    <div class="toolbar-right-group">
      <button 
        class="btn btn-small btn-outline interactive-el btn-export-doc" 
        title="Экспорт главы (Word DOCX, PDF, EPUB, FB2)" 
        @click="$emit('export')"
      >
        <i class="fas fa-file-export"></i> Экспорт
      </button>
      <button 
        v-if="settings?.editor?.requireCtrlForLinks" 
        class="btn btn-small btn-outline interactive-el btn-link-lock" 
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
  title?: string;
  changedFields?: string[];
}>();

defineEmits(['update:editorMode', 'update:title', 'save', 'toggle-history', 'export']);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/EditorToolbar.css"></style>
