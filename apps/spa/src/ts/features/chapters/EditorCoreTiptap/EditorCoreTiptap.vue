<template>
  <div class="editor-core" :class="{ 'word-mode-active': editorMode === 'word' }">
    <!-- Toolbar with inline chapter title -->
    <EditorToolbar 
      :editor="editor"
      :editor-mode="editorMode"
      :mode-options="modeOptions"
      :has-unsaved-changes="hasUnsavedChanges"
      :settings="settings"
      :title="title"
      :changed-fields="changedFields"
      :commands="{
        toggleBold, toggleItalic, toggleStrike, setHeading, toggleBlockquote, 
        toggleBulletList, toggleOrderedList, insertImage, insertTable, insertLink, 
        clearFormatting, toggleLinkLock, analyzeText
      }"
      @update:editor-mode="switchEditorMode"
      @update:title="$emit('update:title', $event); $emit('change')"
      @save="$emit('save')"
      @toggle-history="$emit('toggle-history')"
      @export="openExportModal"
    />

    <!-- Editor Container -->
    <div 
      class="editor-container" 
      :class="{ 'history-changed': changedFields.includes('content') }"
      @contextmenu="handleContextMenu"
    >
      <div v-if="changedFields.includes('content')" class="changed-indicator changed-indicator-content" title="Текст был изменен">
        <span class="badge badge-accent">Изменено</span>
      </div>
      
      <!-- WYSIWYG Mode -->
      <div v-if="editorMode === 'wysiwyg'" class="editor-wrapper">
        <EditorContent :editor="editor" class="editor-content" @scroll="handleScroll" />
      </div>

      <!-- Markdown Mode -->
      <div v-else-if="editorMode === 'markdown'" class="editor-wrapper markdown-mode-wrapper flex-1 flex flex-col h-full w-full min-h-0">
        <textarea 
          ref="markdownTextareaRef"
          v-model="markdownContent" 
          placeholder="# Напишите markdown..."
          class="markdown-editor-textarea"
          @input="onMarkdownInput"
          @keydown="onMarkdownKeydown"
          @contextmenu="handleContextMenu"
        ></textarea>
      </div>

      <!-- Split View -->
      <EditorSplitView
        v-else-if="editorMode === 'split'"
        v-model:markdown-content="markdownContent"
        :editor="editor"
        :left-panel-width="leftPanelWidth"
        :right-panel-width="rightPanelWidth"
        :show-structure="showStructure"
        :selected-block-idx="selectedBlockIdx"
        :document-structure="documentStructure"
        @input="onMarkdownInput"
        @keydown="onMarkdownKeydown"
        @start-resize-left="startResizeLeft"
        @start-resize-right="startResizeRight"
        @scroll-to-block="scrollToBlock"
        @cycle-tag="cycleGlobalTag"
        @contextmenu="handleContextMenu"
        @open-entity-selector="$emit('open-entity-selector')"
      />

      <!-- Word Mode -->
      <WordVibeEditor
        v-else-if="editorMode === 'word'"
        :document="currentSemanticDocument"
        :content="content"
        :chapter-title="title"
        :orientation="isCurrentPageLandscape ? 'landscape' : 'portrait'"
        :page-size="currentPageSize"
        @update:content="onWordContentUpdate"
        @update:document="onWordDocumentUpdate"
        @change="onWordChange"
      />
    </div>
    
    <!-- Status Bar -->
    <EditorStatusBar 
      v-if="editorMode !== 'word'"
      :word-count="wordCount"
      :char-count="charCount"
      :block-count="documentStructure.length"
      :editor-mode="editorMode"
    />

    <!-- Editor Modals & Overlays -->
    <EditorModals
      :project="project"
      :is-entity-selector-open="isEntitySelectorOpen"
      :is-promise-menu-open="isPromiseMenuOpen"
      :promise-menu-pos="promiseMenuPos"
      :existing-promises="existingPromises"
      :is-export-modal-open="isExportModalOpen"
      :current-semantic-document="currentSemanticDocument"
      :is-paragraph-modal-open="isParagraphModalOpen"
      @close-entity-selector="isEntitySelectorOpen = false"
      @insert-entity="handleEntityInsert"
      @close-promise-menu="isPromiseMenuOpen = false"
      @select-promise="handlePromiseSelect"
      @link-milestone="handleMilestoneSelect"
      @close-export-modal="isExportModalOpen = false"
      @close-paragraph-modal="isParagraphModalOpen = false"
      @apply-paragraph-format="handleParagraphFormatApply"
    />
  </div>
</template>

<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3';
import EditorToolbar from './EditorToolbar.vue';
import EditorSplitView from './components/EditorSplitView.vue';
import EditorStatusBar from './components/EditorStatusBar.vue';
import EditorModals from './components/EditorModals.vue';
import { WordVibeEditor } from '@worldwiki/word-vibe';
import { useEditorCoreTiptap } from './useEditorCoreTiptap';
import type { EditorCoreTiptapProps, EditorCoreTiptapEmits } from './EditorCoreTiptap.model';

const props = withDefaults(defineProps<EditorCoreTiptapProps>(), {
  title: '',
  content: '',
  hasUnsavedChanges: false,
  footnotesData: () => ({}),
  initialScrollPos: 0,
  changedFields: () => [],
  existingPromises: () => []
});

const emit = defineEmits<EditorCoreTiptapEmits>();

const {
  modeOptions,
  editorMode,
  settings,
  wordCount,
  charCount,
  markdownContent,
  selectedBlockIdx,
  showStructure,
  leftPanelWidth,
  rightPanelWidth,
  documentStructure,
  editor,
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
  switchEditorMode,
  handleScroll,
  handleContextMenu,
  startResizeLeft,
  startResizeRight,
  scrollToBlock,
  cycleGlobalTag,
  currentSemanticDocument,
  isCurrentPageLandscape,
  currentPageSize,
  isEntitySelectorOpen,
  isPromiseMenuOpen,
  promiseMenuPos,
  isExportModalOpen,
  isParagraphModalOpen,
  openExportModal,
  handleEntityInsert,
  handlePromiseSelect,
  handleMilestoneSelect,
  handleParagraphFormatApply,
  onWordContentUpdate,
  onWordDocumentUpdate,
  onWordChange,
  toggleLinkLock,
  analyzeText,
  markdownTextareaRef
} = useEditorCoreTiptap(props, emit);

defineExpose({
  getEditor: () => editor.value,
  insertEntity: handleEntityInsert
});
</script>
