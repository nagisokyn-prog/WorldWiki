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
      <div v-else-if="editorMode === 'markdown'" class="flex-1 flex-col gap-3">
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

    <!-- Quick Entity Selector -->
    <EntityLinkSelector
      :project="project"
      :is-open="isEntitySelectorOpen"
      @close="isEntitySelectorOpen = false"
      @insert="handleEntityInsert"
    />

    <!-- Promise Context Menu -->
    <PromiseContextMenu
      :is-open="isPromiseMenuOpen"
      :position="promiseMenuPos"
      :existing-promises="existingPromises"
      @close="isPromiseMenuOpen = false"
      @select="handlePromiseSelect"
      @link-milestone="handleMilestoneSelect"
    />

    <!-- Document Export Modal -->
    <DocumentExportModal
      :is-open="isExportModalOpen"
      :document="currentSemanticDocument"
      :project-name="project"
      @close="isExportModalOpen = false"
    />

    <!-- Paragraph Format Modal -->
    <ParagraphFormatModal
      :is-open="isParagraphModalOpen"
      @close="isParagraphModalOpen = false"
      @apply="handleParagraphFormatApply"
    />
  </div>
</template>

<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3';
import EditorToolbar from './EditorToolbar.vue';
import EditorSplitView from './components/EditorSplitView.vue';
import EditorStatusBar from './components/EditorStatusBar.vue';
import { WordVibeEditor, ParagraphFormatModal } from '@worldwiki/word-vibe';
import EntityLinkSelector from './EntityLinkSelector.vue';
import PromiseContextMenu from './PromiseContextMenu.vue';
import { DocumentExportModal } from '../../documents';
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
  toggleLinkLock,
  analyzeText,
  handleScroll,
  scrollToBlock,
  cycleGlobalTag,
  startResizeLeft,
  startResizeRight,
  isExportModalOpen,
  isEntitySelectorOpen,
  isPromiseMenuOpen,
  promiseMenuPos,
  markdownTextareaRef,
  isParagraphModalOpen,
  isCurrentPageLandscape,
  currentPageSize,
  currentSemanticDocument,
  onWordDocumentUpdate,
  onWordContentUpdate,
  onWordChange,
  handleContextMenu,
  handlePromiseSelect,
  handleMilestoneSelect,
  scrollToParagraph,
  handleEntityInsert,
  openExportModal,
  handleParagraphFormatApply
} = useEditorCoreTiptap(props, emit);

defineExpose({
  scrollToParagraph
});
</script>

<style src="@worldwiki/resources/styles/features/chapters/EditorCoreTiptap.css"></style>
