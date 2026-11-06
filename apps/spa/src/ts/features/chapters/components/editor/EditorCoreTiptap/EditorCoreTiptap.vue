<template>
  <div class="editor-core" :class="{ 'word-mode-active': editorMode === 'word' }">
    <EditorToolbar 
      :project="project"
      :chapter-id="chapterId"
      :editor="editor"
      :editor-mode="editorMode"
      :mode-options="modeOptions"
      :has-unsaved-changes="hasUnsavedChanges"
      :is-locked="isLocked"
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
      @change="$emit('change')"
    />


    <EditorBody
      :editor="editor"
      :editor-mode="editorMode"
      :markdown-content="markdownContent"
      :changed-fields="changedFields"
      :left-panel-width="leftPanelWidth"
      :right-panel-width="rightPanelWidth"
      :show-structure="showStructure"
      :selected-block-idx="selectedBlockIdx"
      :document-structure="documentStructure"
      :current-semantic-document="currentSemanticDocument"
      :content="content"
      :title="title"
      :is-current-page-landscape="isCurrentPageLandscape"
      :current-page-size="currentPageSize"
      :is-locked="isLocked"
      @update:markdown-content="markdownContent = $event"
      @textarea-mounted="setMarkdownTextarea"
      @scroll="handleScroll"
      @markdown-input="onMarkdownInput"
      @markdown-keydown="onMarkdownKeydown"
      @contextmenu="handleContextMenu"
      @start-resize-left="startResizeLeft"
      @start-resize-right="startResizeRight"
      @scroll-to-block="scrollToBlock"
      @cycle-tag="cycleGlobalTag"
      @open-entity-selector="$emit('open-entity-selector')"
      @word-content-update="onWordContentUpdate"
      @word-document-update="onWordDocumentUpdate"
      @word-change="onWordChange"
    />
    
    <EditorStatusBar 
      v-if="editorMode !== 'word'"
      :word-count="wordCount"
      :char-count="charCount"
      :block-count="documentStructure?.length ?? 0"
      :editor-mode="editorMode"
    />

    <EditorModals
      :project="project"
      :is-entity-selector-open="isEntitySelectorOpen"
      :entity-selector-query="entitySelectorQuery"
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
import EditorToolbar from './EditorToolbar.vue';
import EditorBody from './components/EditorBody/EditorBody.vue';
import EditorStatusBar from './components/EditorStatusBar/EditorStatusBar.vue';
import EditorModals from './components/EditorModals/EditorModals.vue';
import { useEditorCoreTiptap } from './useEditorCoreTiptap';
import type { EditorCoreTiptapProps, EditorCoreTiptapEmits } from './EditorCoreTiptap.model';

const props = withDefaults(defineProps<EditorCoreTiptapProps>(), {
  chapterId: null,
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
  scrollToParagraph,
  scrollToBlock,
  cycleGlobalTag,
  currentSemanticDocument,
  isCurrentPageLandscape,
  currentPageSize,
  isEntitySelectorOpen,
  entitySelectorQuery,
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
  getEditor,
  setMarkdownTextarea
} = useEditorCoreTiptap(props, emit);

defineExpose({
  getEditor,
  insertEntity: handleEntityInsert,
  scrollToParagraph,
  scrollToBlock,
  analyzeText
});
</script>
