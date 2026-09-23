<template>
  <div 
    class="editor-container" 
    :class="{ 'history-changed': changedFields.includes('content') }"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <div v-if="changedFields.includes('content')" class="changed-indicator changed-indicator-content" title="Текст был изменен">
      <span class="badge badge-accent">Изменено</span>
    </div>
    
    <!-- WYSIWYG Mode -->
    <div v-if="editorMode === 'wysiwyg'" class="editor-wrapper">
      <EditorContent :editor="editor || undefined" class="editor-content" @scroll="$emit('scroll', $event)" />
    </div>

    <!-- Markdown Mode -->
    <div v-else-if="editorMode === 'markdown'" class="editor-wrapper markdown-mode-wrapper flex-1 flex flex-col h-full w-full min-h-0">
      <textarea 
        :ref="(el) => $emit('textarea-mounted', el as HTMLTextAreaElement | null)"
        :value="markdownContent" 
        placeholder="# Напишите markdown..."
        class="markdown-editor-textarea"
        @input="$emit('update:markdownContent', ($event.target as HTMLTextAreaElement).value); $emit('markdown-input', $event)"
        @keydown="$emit('markdown-keydown', $event)"
        @contextmenu="$emit('contextmenu', $event)"
      ></textarea>
    </div>

    <!-- Split View -->
    <EditorSplitView
      v-else-if="editorMode === 'split'"
      :markdown-content="markdownContent"
      :editor="editor || undefined"
      :left-panel-width="leftPanelWidth"
      :right-panel-width="rightPanelWidth"
      :show-structure="showStructure"
      :selected-block-idx="selectedBlockIdx"
      :document-structure="documentStructure"
      @update:markdown-content="$emit('update:markdownContent', $event)"
      @input="$emit('markdown-input', $event)"
      @keydown="$emit('markdown-keydown', $event)"
      @start-resize-left="$emit('start-resize-left', $event)"
      @start-resize-right="$emit('start-resize-right', $event)"
      @scroll-to-block="$emit('scroll-to-block', $event)"
      @cycle-tag="$emit('cycle-tag', $event)"
      @contextmenu="$emit('contextmenu', $event)"
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
      @update:content="$emit('word-content-update', $event)"
      @update:document="$emit('word-document-update', $event)"
      @change="$emit('word-change')"
    />
  </div>
</template>

<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3';
import type { Editor } from '@tiptap/vue-3';
import EditorSplitView from './EditorSplitView.vue';
import { WordVibeEditor } from '@worldwiki/word-vibe';
import type { PageSize, WordDocumentDTO } from '@worldwiki/word-vibe';
import type { SemanticDocument } from '@/services/document/ast/types';
import type { DocumentBlock } from '../hooks/useTiptapSplitView';

defineProps<{
  editor?: Editor | null;
  editorMode: 'wysiwyg' | 'markdown' | 'split' | 'word';
  markdownContent: string;
  changedFields: string[];
  leftPanelWidth: number;
  rightPanelWidth: number;
  showStructure: boolean;
  selectedBlockIdx: number;
  documentStructure: DocumentBlock[];
  currentSemanticDocument: SemanticDocument;
  content: string;
  title: string;
  isCurrentPageLandscape: boolean;
  currentPageSize: PageSize;
}>();

defineEmits<{
  (e: 'update:markdownContent', val: string): void;
  (e: 'textarea-mounted', el: HTMLTextAreaElement | null): void;
  (e: 'scroll', ev: Event): void;
  (e: 'markdown-input', ev: Event): void;
  (e: 'markdown-keydown', ev: KeyboardEvent): void;
  (e: 'contextmenu', ev: MouseEvent): void;
  (e: 'start-resize-left', ev: MouseEvent): void;
  (e: 'start-resize-right', ev: MouseEvent): void;
  (e: 'scroll-to-block', idx: number): void;
  (e: 'cycle-tag', idx: number): void;
  (e: 'open-entity-selector'): void;
  (e: 'word-content-update', val: string): void;
  (e: 'word-document-update', doc: WordDocumentDTO): void;
  (e: 'word-change'): void;
}>();
</script>
