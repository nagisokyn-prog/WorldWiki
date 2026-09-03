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

      <!-- Split View: Markdown + WYSIWYG + Block Structure -->
      <div v-else-if="editorMode === 'split'" class="split-editor-box">
        
        <!-- Left: Markdown Editor -->
        <div :style="{ '--split-left': leftPanelWidth + '%' }" class="split-left-panel flex-col overflow-hidden border-r">
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
            @contextmenu="handleContextMenu"
          ></textarea>
        </div>

        <!-- Drag Handle Left -->
        <div 
          class="drag-handle-col"
          title="Потащите для изменения ширины"
          @mousedown="startResizeLeft"
        ></div>

        <!-- Middle: WYSIWYG Preview (растягивается если структура скрыта) -->
        <div :style="{ '--split-right': rightPanelWidth + '%' }" class="split-middle-panel flex-col overflow-hidden" :class="{ 'border-r': showStructure, 'is-full-width': !showStructure }">
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
          <div class="split-panel-header split-panel-header-structure">🧩 Структура (Ctrl+R)</div>
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

      <!-- Word Mode (А4 / Книга на базе ядра RK Word Editor) -->
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
    
    <!-- Status Bar for WYSIWYG, Markdown, and Split modes -->
    <div v-if="editorMode !== 'word'" class="status-bar">
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
      <div v-if="changedFields.includes('footnotes')" class="changed-indicator changed-indicator-footnotes" title="Сноски были изменены">
          <span class="badge badge-accent">Изменено</span>
      </div>
    </div>

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
  footnotes,
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
