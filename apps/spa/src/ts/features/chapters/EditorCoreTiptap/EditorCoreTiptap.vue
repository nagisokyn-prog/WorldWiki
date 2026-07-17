<template>
  <div class="editor-core" style="flex: 1; display: flex; flex-direction: column; padding: 24px; overflow: hidden; min-width: 0;">
    
    <!-- Toolbar -->
    <EditorToolbar 
      :editor="editor"
      :editorMode="editorMode"
      :modeOptions="modeOptions"
      :hasUnsavedChanges="hasUnsavedChanges"
      :settings="settings"
      :commands="{
        toggleBold, toggleItalic, toggleStrike, setHeading, toggleBlockquote, 
        toggleBulletList, toggleOrderedList, insertImage, insertTable, insertLink, 
        clearFormatting, insertFootnote, toggleLinkLock, analyzeText
      }"
      @update:editorMode="switchEditorMode"
      @save="$emit('save')"
      @toggle-history="$emit('toggle-history')"
    />

    <!-- Title -->
    <div class="chapter-header" style="margin-bottom: 20px; position: relative;" :class="{ 'history-changed': changedFields.includes('title') }">
      <div v-if="changedFields.includes('title')" class="changed-indicator" style="position: absolute; right: -8px; top: -8px; z-index: 5;" title="Поле было изменено">
          <span style="background: var(--accent); color: white; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">Изменено</span>
      </div>
      <input type="text" :value="title" placeholder="Название главы..." style="width: 100%; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--accent); font-size: 24px; font-weight: 700; outline: none; transition: all 0.3s; padding-bottom: 4px;" class="chapter-title-input" @input="updateTitle">
    </div>

    <!-- Editor Container -->
    <div class="editor-container" style="flex: 1; display: flex; gap: 16px; overflow: hidden; min-width: 0; position: relative;" :class="{ 'history-changed': changedFields.includes('content') }">
      <div v-if="changedFields.includes('content')" class="changed-indicator" style="position: absolute; right: 10px; top: 10px; z-index: 5;" title="Текст был изменен">
          <span style="background: var(--accent); color: white; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">Изменено</span>
      </div>
      


      <!-- WYSIWYG Mode -->
      <div v-if="editorMode === 'wysiwyg'" class="editor-wrapper" style="flex: 1; overflow: auto; border-radius: 8px; border: 1px solid var(--border-color); background: #ffffff; color: #000000;">
        <EditorContent :editor="editor" class="editor-content" @scroll="handleScroll" />
      </div>

      <!-- Markdown Mode -->
      <div v-else-if="editorMode === 'markdown'" style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
        <textarea 
          v-model="markdownContent" 
          placeholder="# Напишите markdown..."
          style="flex: 1; background: #ffffff; color: #000000; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; resize: none; outline: none;"
          @input="onMarkdownInput"
        ></textarea>
      </div>

      <!-- Split View: Markdown + WYSIWYG + Block Structure (тонкие разделители) -->
      <div v-else-if="editorMode === 'split'" style="flex: 1; display: flex; overflow: hidden; border-radius: 8px; border: 1px solid var(--border-color);">
        
        <!-- Left: Markdown Editor -->
        <div :style="{ flex: `0 0 ${leftPanelWidth}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-color)' }">
          <div style="background: var(--bg-input); border-bottom: 1px solid var(--border-color); padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted);">✏️ Markdown</div>
          <textarea 
            v-model="markdownContent" 
            placeholder="# Напишите markdown..."
            style="flex: 1; background: #ffffff; color: #000000; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6; resize: none; outline: none; border: none; padding: 12px;"
            @input="onMarkdownInput"
          ></textarea>
        </div>

        <!-- Drag Handle Left -->
        <div 
          style="width: 6px; background: var(--border-color); cursor: col-resize; transition: background 0.2s; flex-shrink: 0;"
          title="Потащите для изменения ширины"
          @mousedown="startResizeLeft"
          @mouseover="($event.target as HTMLElement).style.background = 'var(--accent)'"
          @mouseout="($event.target as HTMLElement).style.background = 'var(--border-color)'"
        ></div>

        <!-- Middle: WYSIWYG Preview (растягивается если структура скрыта) -->
        <div :style="{ flex: showStructure ? `0 0 ${rightPanelWidth}%` : '1', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: showStructure ? '1px solid var(--border-color)' : 'none' }">
          <div style="background: var(--bg-input); border-bottom: 1px solid var(--border-color); padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted);">👁️ Preview</div>
          <div style="flex: 1; overflow: auto; position: relative;">
            <EditorContent :editor="editor" class="editor-content-split" />
          </div>
        </div>

        <!-- Drag Handle Right -->
        <div 
          v-if="showStructure"
          style="width: 6px; background: var(--border-color); cursor: col-resize; transition: background 0.2s; flex-shrink: 0;"
          title="Потащите для изменения ширины"
          @mousedown="startResizeRight"
          @mouseover="($event.target as HTMLElement).style.background = 'var(--accent)'"
          @mouseout="($event.target as HTMLElement).style.background = 'var(--border-color)'"
        ></div>

        <!-- Right: Block Structure (скрывается по Ctrl+R) -->
        <div v-if="showStructure" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-input);">
          <div style="background: rgba(255,255,255,0.1); border-bottom: 1px solid var(--border-color); padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted);">🧩 Структура (Ctrl+R)</div>
          <div style="flex: 1; overflow-y: auto; padding: 8px; border-left: 1px solid var(--border-color);">
            <div v-for="(block, idx) in documentStructure" :key="idx" style="margin-bottom: 4px; padding: 6px 8px; border-left: 2px solid var(--accent); background: rgba(139,92,246,0.1); border-radius: 3px; font-size: 11px; cursor: pointer; transition: all 0.2s; display: flex; gap: 6px; align-items: flex-start;" :class="{ 'block-selected': selectedBlockIdx === idx }" @click="scrollToBlock(idx)">
              <div v-if="block.semanticTag" class="interactive-el" :style="block.semanticTag === 'desc' ? 'background: rgba(148,163,184,0.1); color: #94a3b8;' : block.semanticTag === 'dialog' ? 'background: rgba(56,189,248,0.1); color: #38bdf8;' : 'background: rgba(192,132,252,0.1); color: #c084fc;'" style="font-weight: 800; font-size: 9px; padding: 2px 4px; border-radius: 3px; flex-shrink: 0; cursor: pointer;" @click.stop="cycleGlobalTag(block.pIndex!)">{{ block.semanticTag === 'desc' ? '!о' : block.semanticTag === 'dialog' ? '!д' : '!м' }}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: var(--accent); margin-bottom: 2px; font-size: 10px;">{{ block.type }}</div>
                <div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10px;">{{ block.text }}</div>
              </div>
            </div>
            <div v-if="documentStructure.length === 0" style="color: var(--text-muted); font-size: 11px; padding: 12px; text-align: center;">Нет блоков</div>
          </div>
        </div>

      </div>
    </div>
    
    <!-- Status Bar -->
    <div class="status-bar" style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: var(--text-muted);">
      <div style="display: flex; gap: 16px;">
        <span>Слов: {{ wordCount }}</span>
        <span>Символов: {{ charCount }}</span>
        <span v-if="editorMode === 'split'">Блоков: {{ documentStructure.length }}</span>
        <span style="margin-left: 20px; opacity: 0.7;">
          Shift+Enter для переноса | 
          <span v-if="editorMode === 'split'">Ctrl+R скрыть структуру</span>
        </span>
      </div>
      <div>
        <span v-if="settings?.editor?.requireCtrlForLinks" style="color: var(--accent); font-weight: 600;">
          <i class="fas fa-lock" style="margin-right: 4px;"></i>
          Зажмите Ctrl для перехода
        </span>
        <span v-else>
          Обычный клик открывает ссылки
        </span>
      </div>
    </div>

    <!-- Footnotes Panel -->
    <div v-if="Object.keys(footnotes).length > 0" class="footnotes-panel" style="margin-top: 20px; padding-top: 10px; border-top: 1px solid var(--border-color); position: relative;" :class="{ 'history-changed': changedFields.includes('footnotes') }">
      <div v-if="changedFields.includes('footnotes')" class="changed-indicator" style="position: absolute; right: 0; top: -10px; z-index: 5;" title="Сноски были изменены">
          <span style="background: var(--accent); color: white; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">Изменено</span>
      </div>
      <div v-for="(fn, id) in footnotes" :key="id" style="display: flex; gap: 8px; margin-bottom: 4px; font-size: 13px;">
        <span style="color: var(--accent);">[{{ id }}]</span>
        <span style="flex: 1;">{{ fn.text }}</span>
        <button style="background: none; border: none; color: #ef4444; cursor: pointer;" @click="deleteFootnote(id as string)">✕</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { settingsService } from '@worldwiki/components';
import { useTiptapEditor } from './useTiptapEditor';
import EditorToolbar from './EditorToolbar.vue';

const props = defineProps({
  project: { type: String, required: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  hasUnsavedChanges: { type: Boolean, default: false },
  footnotesData: { type: Object, default: () => ({}) },
  initialScrollPos: { type: Number, default: 0 },
  changedFields: { type: Array as () => string[], default: () => [] }
});

const emit = defineEmits(['update:title', 'update:content', 'update:footnotesData', 'change', 'save', 'openEntity', 'scroll-change', 'toggle-history']);

const {
    modeOptions,
    getStateKey,
    loadInitialMode,
    editorMode,
    settings,
    editorUpdateKey,
    wordCount,
    charCount,
    footnotes,
    ctrlPressed,
    markdownContent,
    selectedBlockIdx,
    showStructure,
    leftPanelWidth,
    rightPanelWidth,
    resizing,
    turndownService,
    mdIt,
    savePositionState,
    restorePositionState,
    handleBeforeUnload,
    documentStructure,
    editor,
    updateTitle,
    updateStats,
    preprocessMarkdown,
    onMarkdownInput,
    syncMarkdownFromEditor,
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
} = useTiptapEditor(props, emit);

</script>

<style scoped>
.history-changed {
  position: relative;
  background-color: rgba(245, 166, 35, 0.05) !important;
  border-radius: 8px;
  padding: 8px;
  margin: -8px;
  box-shadow: inset 0 0 0 2px rgba(245, 166, 35, 0.5);
}

.changed-indicator {
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.editor-wrapper {
  background: #ffffff;
  color: #000000;
}

.editor-content {
  padding: 20px 20px 20px 60px;
  font-family: var(--font-family);
  font-size: 16px;
  line-height: 1.8;
  color: #000000;
}

.editor-content-split {
  padding: 12px 12px 12px 50px;
  font-family: var(--font-family);
  font-size: 13px;
  line-height: 1.6;
  color: #000000;
}

:deep(.ProseMirror) {
  color: #000000 !important;
  background: #ffffff !important;
  outline: none;
  min-height: 100%;
}

/* Видимые границы блоков в тексте */
:deep(.ProseMirror > p) {
  padding: 4px 0;
  border-bottom: 0.5px solid #e0e0e0;
  margin: 0;
}

:deep(.ProseMirror > h1),
:deep(.ProseMirror > h2),
:deep(.ProseMirror > h3),
:deep(.ProseMirror > h4),
:deep(.ProseMirror > h5),
:deep(.ProseMirror > h6) {
  border-bottom: 1px solid #d0d0d0;
  margin: 8px 0 4px 0;
  padding-bottom: 4px;
}

:deep(.ProseMirror > blockquote) {
  border-left: 3px solid var(--accent);
  margin: 4px 0;
  padding: 4px 0 4px 8px;
}

:deep(.ProseMirror > ul),
:deep(.ProseMirror > ol) {
  border-bottom: 0.5px solid #e0e0e0;
  padding: 4px 0 4px 20px;
  margin: 0;
}

:deep(.ProseMirror > table) {
  border-collapse: collapse;
  margin: 4px 0;
  width: 100%;
  border: 1px solid #cccccc;
}

:deep(.ProseMirror a) {
  cursor: pointer !important;
  text-decoration: none;
  color: var(--accent);
}
:deep(.ProseMirror a:hover) {
  text-decoration: underline !important;
}

:deep(.ProseMirror table) {
  border-collapse: collapse;
  margin: 0;
  overflow: hidden;
}

:deep(.ProseMirror td), :deep(.ProseMirror th) {
  border: 1px solid #cccccc;
  padding: 8px;
  position: relative;
  vertical-align: top;
}

:deep(.ProseMirror th) {
  background-color: #f0f0f0;
  font-weight: bold;
}
</style>

<style>
.global-tag-badge {
  width: 26px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  background: var(--bg-panel, #1a1a2e);
  border: 1px solid var(--border-color, #333);
  color: var(--text-muted, #888);
}

.global-tag-badge.desc { color: #94a3b8; }
.global-tag-badge.dialog {
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.05);
}
.global-tag-badge.thought {
  color: #c084fc;
  border-color: rgba(192, 132, 252, 0.3);
  background: rgba(192, 132, 252, 0.05);
}

.global-tag-badge:hover {
  filter: brightness(1.2);
  transform: scale(1.05);
}
</style>
