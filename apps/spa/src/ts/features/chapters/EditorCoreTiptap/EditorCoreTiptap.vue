<template>
  <div class="editor-core">
    
    <!-- Toolbar -->
    <EditorToolbar 
      :editor="editor"
      :editor-mode="editorMode"
      :mode-options="modeOptions"
      :has-unsaved-changes="hasUnsavedChanges"
      :settings="settings"
      :commands="{
        toggleBold, toggleItalic, toggleStrike, setHeading, toggleBlockquote, 
        toggleBulletList, toggleOrderedList, insertImage, insertTable, insertLink, 
        clearFormatting, insertFootnote, toggleLinkLock, analyzeText
      }"
      @update:editor-mode="switchEditorMode"
      @save="$emit('save')"
      @toggle-history="$emit('toggle-history')"
    />

    <!-- Title -->
    <div class="chapter-header">
      <div v-if="changedFields.includes('title')" class="changed-indicator" style="position: absolute; right: -8px; top: -8px; z-index: 5;" title="Поле было изменено">
          <span class="badge badge-accent">Изменено</span>
      </div>
      <input type="text" :value="title" placeholder="Название главы..." class="chapter-title-input" @input="updateTitle">
    </div>

    <!-- Editor Container -->
    <div class="editor-container" :class="{ 'history-changed': changedFields.includes('content') }">
      <div v-if="changedFields.includes('content')" class="changed-indicator" style="position: absolute; right: 10px; top: 10px; z-index: 5;" title="Текст был изменен">
          <span class="badge badge-accent">Изменено</span>
      </div>
      
      <!-- WYSIWYG Mode -->
      <div v-if="editorMode === 'wysiwyg'" class="editor-wrapper">
        <EditorContent :editor="editor" class="editor-content" @scroll="handleScroll" />
      </div>

      <!-- Markdown Mode -->
      <div v-else-if="editorMode === 'markdown'" class="flex-1 flex-col gap-3">
        <textarea 
          ref="markdownTextareaRef"
          v-model="markdownContent" 
          placeholder="# Напишите markdown..."
          class="markdown-editor-textarea"
          @input="onMarkdownInput"
          @keydown="onMarkdownKeydown"
        ></textarea>
      </div>

      <!-- Split View: Markdown + WYSIWYG + Block Structure -->
      <div v-else-if="editorMode === 'split'" class="split-editor-box">
        
        <!-- Left: Markdown Editor -->
        <div :style="{ flex: `0 0 ${leftPanelWidth}%` }" class="flex-col overflow-hidden border-r">
          <div class="split-panel-header">✏️ Markdown</div>
          <textarea 
            ref="markdownTextareaRef"
            v-model="markdownContent" 
            placeholder="# Напишите markdown..."
            class="markdown-editor-textarea split"
            @input="onMarkdownInput"
            @keydown.exact="onMarkdownKeydown"
            @keydown.exact.ctrl.meta.shift.q.prevent="$emit('open-entity-selector')"
            @keydown.exact.ctrl.meta.prevent.enter="$emit('open-entity-selector')"
          ></textarea>
        </div>

        <!-- Drag Handle Left -->
        <div 
          class="drag-handle-col"
          title="Потащите для изменения ширины"
          @mousedown="startResizeLeft"
        ></div>

        <!-- Middle: WYSIWYG Preview (растягивается если структура скрыта) -->
        <div :style="{ flex: showStructure ? `0 0 ${rightPanelWidth}%` : '1' }" class="flex-col overflow-hidden" :class="{ 'border-r': showStructure }">
          <div class="split-panel-header">👁️ Preview</div>
          <div class="flex-1 overflow-auto relative">
            <EditorContent :editor="editor" class="editor-content-split" />
          </div>
        </div>

        <!-- Drag Handle Right -->
        <div 
          v-if="showStructure"
          class="drag-handle-col"
          title="Потащите для изменения ширины"
          @mousedown="startResizeRight"
        ></div>

        <!-- Right: Block Structure (скрывается по Ctrl+R) -->
        <div v-if="showStructure" class="flex-1 flex-col overflow-hidden bg-input">
          <div class="split-panel-header" style="background: rgba(255,255,255,0.1);">🧩 Структура (Ctrl+R)</div>
          <div class="flex-1 overflow-y-auto p-2 border-l">
            <div v-for="(block, idx) in documentStructure" :key="idx" class="structure-block-item" :class="{ 'block-selected': selectedBlockIdx === idx }" @click="scrollToBlock(idx)">
              <div v-if="block.semanticTag" class="interactive-el semantic-badge" :class="block.semanticTag === 'desc' ? 'desc' : block.semanticTag === 'dialog' ? 'dialog' : 'other'" @click.stop="cycleGlobalTag(block.pIndex!)">{{ block.semanticTag === 'desc' ? '!о' : block.semanticTag === 'dialog' ? '!д' : '!м' }}</div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-accent mb-1 text-xs">{{ block.type }}</div>
                <div class="text-muted text-xs truncate">{{ block.text }}</div>
              </div>
            </div>
            <div v-if="documentStructure.length === 0" class="text-muted text-xs p-3 text-center">Нет блоков</div>
          </div>
        </div>

      </div>
    </div>
    
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="flex gap-4">
        <span>Слов: {{ wordCount }}</span>
        <span>Символов: {{ charCount }}</span>
        <span v-if="editorMode === 'split'">Блоков: {{ documentStructure.length }}</span>
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

    <!-- Footnotes Panel -->
    <div v-if="Object.keys(footnotes).length > 0" class="footnotes-panel" :class="{ 'history-changed': changedFields.includes('footnotes') }">
      <div v-if="changedFields.includes('footnotes')" class="changed-indicator" style="position: absolute; right: 0; top: -10px; z-index: 5;" title="Сноски были изменены">
          <span class="badge badge-accent">Изменено</span>
      </div>
      <div v-for="(fn, id) in footnotes" :key="id" class="flex gap-2 mb-1 text-sm">
        <span class="text-accent">[{{ id }}]</span>
        <span class="flex-1">{{ fn.text }}</span>
        <button class="bg-transparent border-none text-error cursor-pointer" @click="deleteFootnote(id as string)">✕</button>
      </div>
    </div>

    <!-- Quick Entity Selector -->
    <EntityLinkSelector
      :project="project"
      :is-open="isEntitySelectorOpen"
      @close="isEntitySelectorOpen = false"
      @insert="handleEntityInsert"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { useTiptapEditor } from './useTiptapEditor';
import EditorToolbar from './EditorToolbar.vue';
import EntityLinkSelector from './EntityLinkSelector.vue';

const isEntitySelectorOpen = ref(false);
const activeEditorTarget = ref<'wysiwyg'|'markdown'>('markdown');

const handleOpenEntitySelector = (e: Event) => {
  const detail = (e as CustomEvent<{ target?: 'wysiwyg' | 'markdown' }>).detail;
  activeEditorTarget.value = detail?.target || 'markdown';
  isEntitySelectorOpen.value = true;
};

const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null);

const handleEntityInsert = (payload: { type: string; id: string }) => {
  const url = `ui_editor.html?project=${encodeURIComponent(props.project)}&type=${encodeURIComponent(payload.type)}&id=${encodeURIComponent(payload.id)}`;
  const linkText = `[${url}]`;

  if (activeEditorTarget.value === 'wysiwyg' && (editorMode.value === 'wysiwyg' || editorMode.value === 'split')) {
    if (editor.value) {
      const { state } = editor.value;
      const { $from } = state.selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
      const match = /\(\(([^)]+)\)\)$/.exec(textBefore);
      if (match) {
        const start = $from.pos - match[0].length;
        const end = $from.pos;
        editor.value.chain().focus()
          .deleteRange({ from: start, to: end })
          .insertContent(`<a href="/${url}">${match[1]}</a>`)
          .run();
      }
    }
  } else if (activeEditorTarget.value === 'markdown' && (editorMode.value === 'markdown' || editorMode.value === 'split')) {
    const target = markdownTextareaRef.value;
    if (target) {
      target.focus();
      document.execCommand('insertText', false, linkText);
    }
  }
};

const props = withDefaults(defineProps<{
  project: string;
  title?: string;
  content?: string;
  hasUnsavedChanges?: boolean;
  footnotesData?: Record<string, { id: string; text: string }>;
  initialScrollPos?: number;
  changedFields?: string[];
}>(), {
  title: '',
  content: '',
  hasUnsavedChanges: false,
  footnotesData: () => ({}),
  initialScrollPos: 0,
  changedFields: () => []
});

const emit = defineEmits(['update:title', 'update:content', 'update:footnotesData', 'change', 'save', 'openEntity', 'scroll-change', 'toggle-history', 'open-entity-selector']);

const {
    modeOptions,
    editorMode,
    settings,
    wordCount,
    charCount,
    footnotes,
    markdownContent,
    selectedBlockIdx,
    showStructure,
    leftPanelWidth,
    rightPanelWidth,
    documentStructure,
    editor,
    updateTitle,
    onMarkdownInput,
    onMarkdownKeydown,
    toggleBold,
    toggleItalic,
    toggleStrike,
    setHeading,
    toggleBlockquote,
    toggleBulletList,
    toggleOrderedList,
    insertImage,
    insertLink,
    insertTable,
    clearFormatting,
    insertFootnote,
    deleteFootnote,
    switchEditorMode,
    toggleLinkLock,
    analyzeText,
    handleScroll,
    scrollToBlock,
    cycleGlobalTag,
    startResizeLeft,
    startResizeRight
} = useTiptapEditor(props, emit as (event: string, ...args: unknown[]) => void);

import { openEntityEditorWindow } from '../../../utils/windowManager';

const handleOpenEntityWindow = (e: Event) => {
  const { type, id } = (e as CustomEvent<{ type: string; id: string }>).detail;
  // We need to resolve name, but we can pass a generic one and the window will load it
  openEntityEditorWindow(props.project, type, id, id.split(':').pop() || 'Сущность');
};

onMounted(() => {
  document.addEventListener('ww:open-entity-selector', handleOpenEntitySelector);
  document.addEventListener('ww:open-entity-window', handleOpenEntityWindow);
});

onUnmounted(() => {
  document.removeEventListener('ww:open-entity-selector', handleOpenEntitySelector);
  document.removeEventListener('ww:open-entity-window', handleOpenEntityWindow);
});
</script>

<style src="@worldwiki/resources/styles/features/chapters/EditorCoreTiptap.css"></style>
