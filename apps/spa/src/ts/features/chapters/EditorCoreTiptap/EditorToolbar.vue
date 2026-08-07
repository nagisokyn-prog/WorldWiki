<template>
  <div class="chapter-toolbar" style="padding: 12px 0; border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" :class="{ active: editor?.isActive('bold') }" title="Жирный (Ctrl+B)" @click="commands.toggleBold">B</button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" :class="{ active: editor?.isActive('italic') }" title="Курсив (Ctrl+I)" @click="commands.toggleItalic">I</button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" :class="{ active: editor?.isActive('strike') }" title="Зачеркнутый" @click="commands.toggleStrike">S</button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" :class="{ active: editor?.isActive('heading', { level: 2 }) }" title="Заголовок" @click="commands.setHeading(2)">H</button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" :class="{ active: editor?.isActive('blockquote') }" title="Цитата" @click="commands.toggleBlockquote">"</button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" :class="{ active: editor?.isActive('bulletList') }" title="Список" @click="commands.toggleBulletList">•</button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" :class="{ active: editor?.isActive('orderedList') }" title="Нумерованный список" @click="commands.toggleOrderedList">1.</button>
      <div v-if="editorMode !== 'markdown'" style="width: 1px; height: 24px; background: var(--border-color); margin: 0 4px;"></div>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" title="Картинка" @click="commands.insertImage"><i class="fas fa-image"></i></button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" title="Таблица" @click="commands.insertTable"><i class="fas fa-table"></i></button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" title="Ссылка" @click="commands.insertLink"><i class="fas fa-link"></i></button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" title="Очистить формат" @click="commands.clearFormatting"><i class="fas fa-eraser"></i></button>
      <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" title="Сноска" @click="commands.insertFootnote"><i class="fas fa-quote-left"></i></button>
    </div>
    
    <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">

      <button class="toolbar-btn interactive-el" title="Анализ текста" @click="commands.analyzeText"><i class="fas fa-chart-bar"></i></button>
      <XboxWheel 
        :model-value="editorMode"
        class="editor-mode-wheel" 
        :options="modeOptions" 
        style="width: 150px; flex-shrink: 0;" 
        @update:model-value="$emit('update:editorMode', $event)"
      />
      <button class="btn-new interactive-el" :class="{ 'unsaved-glow': hasUnsavedChanges }" style="background: var(--accent); color: white; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; height: 32px; white-space: nowrap;" @click="$emit('save')">
        💾 {{ hasUnsavedChanges ? 'Сохранить*' : 'Сохранено' }}
      </button>
      <button class="btn-new interactive-el" style="background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 500; height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px;" title="История изменений" @click="$emit('toggle-history')">
        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="display: inline; vertical-align: middle;"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { Editor } from '@tiptap/vue-3';

const props = defineProps<{
  editor: Editor | null | undefined;
  editorMode: string;
  modeOptions: any[];
  hasUnsavedChanges: boolean;
  settings: any;
  commands: Record<string, (...args: any[]) => void>;
}>();

const emit = defineEmits(['update:editorMode', 'save', 'toggle-history']);
</script>

<style scoped>
.toolbar-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-main);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  min-width: 32px;
  transition: all 0.2s;
}
.toolbar-btn:hover { background: var(--bg-input); border-color: var(--border-color); }
.toolbar-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

.link-lock-btn:hover {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px var(--accent-glow);
}
.link-lock-btn.locked {
  border-color: var(--accent) !important;
  background: rgba(139, 92, 246, 0.1) !important;
}
</style>
