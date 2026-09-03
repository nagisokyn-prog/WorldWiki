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
        :content="content"
        :chapter-title="title"
        :orientation="isCurrentPageLandscape ? 'landscape' : 'portrait'"
        :page-size="currentPageSize"
        @update:content="$emit('update:content', $event)"
        @change="$emit('change')"
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

    <!-- Paragraph Format Modal (Screenshot 3) -->
    <ParagraphFormatModal
      :is-open="isParagraphModalOpen"
      @close="isParagraphModalOpen = false"
      @apply="handleParagraphFormatApply"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { useTiptapEditor } from './useTiptapEditor';
import EditorToolbar from './EditorToolbar.vue';
import { WordVibeEditor, ParagraphFormatModal, type ParagraphFormatData, type PageSize } from '@worldwiki/word-vibe';
import EntityLinkSelector from './EntityLinkSelector.vue';
import PromiseContextMenu, { type PromiseTypeOption } from './PromiseContextMenu.vue';
import { DocumentExportModal } from '../../documents';
import { ASTAdapter, type TiptapDocJson } from '../../../services/document/ast/ASTAdapter';
import { normalizeSemanticDocument } from '../../../services/document/ast/ASTNormalizer';
import type { SemanticDocument } from '../../../services/document/ast/types';
import type { PlotPromise } from '@/types/generated/PlotPromise';

const isExportModalOpen = ref(false);
const isEntitySelectorOpen = ref(false);
const activeEditorTarget = ref<'wysiwyg'|'markdown'>('markdown');

const isPromiseMenuOpen = ref(false);
const promiseMenuPos = ref({ x: 0, y: 0 });
const selectedPromiseData = ref<{ quote: string; paragraph_index: number; block_id?: string | null }>({
  quote: '',
  paragraph_index: 1,
  block_id: null
});

const handleOpenEntitySelector = (e: Event) => {
  const detail = (e as CustomEvent<{ target?: 'wysiwyg' | 'markdown' }>).detail;
  activeEditorTarget.value = detail?.target || 'markdown';
  isEntitySelectorOpen.value = true;
};

const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null);

const handleContextMenu = (e: MouseEvent) => {
  let selectedText = '';
  let paragraphIndex = 1;

  if (editorMode.value === 'wysiwyg' || editorMode.value === 'split') {
    if (editor.value) {
      const { selection, doc } = editor.value.state;
      if (!selection.empty) {
        selectedText = doc.textBetween(selection.from, selection.to, ' ').trim();
        
        // Точный подсчет номера блока верхнего уровня (1-based)
        let blockCount = 0;
        let foundIdx = 1;
        doc.forEach((node, offset) => {
          blockCount++;
          if (selection.from >= offset && selection.from <= offset + node.nodeSize) {
            foundIdx = blockCount;
          }
        });
        paragraphIndex = Math.max(1, foundIdx);
      }
    }
  }

  if (!selectedText && markdownTextareaRef.value) {
    const ta = markdownTextareaRef.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start !== end) {
      selectedText = ta.value.substring(start, end).trim();
      const beforeText = ta.value.substring(0, start);
      const lines = beforeText.split('\n');
      paragraphIndex = Math.max(1, lines.length);
    }
  }

  if (!selectedText) {
    const winSel = window.getSelection()?.toString().trim();
    if (winSel) {
      selectedText = winSel;
    }
  }

  if (selectedText) {
    e.preventDefault();
    selectedPromiseData.value = {
      quote: selectedText,
      paragraph_index: paragraphIndex,
      block_id: null
    };
    promiseMenuPos.value = { x: e.clientX, y: e.clientY };
    isPromiseMenuOpen.value = true;
  }
};

const handlePromiseSelect = (item: PromiseTypeOption) => {
  emit('create-promise', {
    kind: item.kind,
    quote: selectedPromiseData.value.quote,
    paragraph_index: selectedPromiseData.value.paragraph_index,
    block_id: selectedPromiseData.value.block_id
  });
};

const handleMilestoneSelect = (payload: { promise: PlotPromise; stage: 'progression' | 'resolution' }) => {
  if (!payload.promise.id) return;
  emit('link-milestone', {
    promiseId: payload.promise.id,
    stage: payload.stage,
    quote: selectedPromiseData.value.quote,
    paragraph_index: selectedPromiseData.value.paragraph_index,
    block_id: selectedPromiseData.value.block_id
  });
};

const scrollToParagraph = (paragraphIndex: number, quote?: string) => {
  if (editorMode.value === 'wysiwyg' || editorMode.value === 'split') {
    if (editor.value) {
      const editorDom = editor.value.view.dom;
      const allNodes = Array.from(
        editorDom.querySelectorAll('.semantic-paragraph-node, .ProseMirror > *, p, h1, h2, h3, h4, h5, h6, blockquote, li, tr')
      ) as HTMLElement[];
      let targetEl: HTMLElement | null = null;

      // 1. Поиск по нормализованному тексту цитаты
      if (quote && quote.trim()) {
        const cleanQuote = quote.replace(/\s+/g, ' ').trim().toLowerCase();
        for (const el of allNodes) {
          const elText = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (elText.includes(cleanQuote)) {
            targetEl = el;
            break;
          }
        }
      }

      // 2. Если по цитате не нашли, берем по порядковому номеру блока верхнего уровня
      if (!targetEl) {
        const topBlocks = Array.from(editorDom.children) as HTMLElement[];
        if (topBlocks.length > 0) {
          const idx = Math.max(0, Math.min(topBlocks.length - 1, paragraphIndex - 1));
          targetEl = topBlocks[idx] || null;
        }
      }

      if (targetEl) {
        const wrapper = (editorDom.closest('.editor-wrapper') || editorDom.parentElement) as HTMLElement | null;
        if (wrapper && wrapper.scrollHeight > wrapper.clientHeight) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();
          const offsetTop = targetRect.top - wrapperRect.top + wrapper.scrollTop;
          wrapper.scrollTo({
            top: Math.max(0, offsetTop - wrapper.clientHeight / 2 + targetRect.height / 2),
            behavior: 'smooth'
          });
        } else {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        targetEl.classList.remove('promise-highlight-target');
        void targetEl.offsetWidth; // trigger reflow
        targetEl.classList.add('promise-highlight-target');
        setTimeout(() => {
          targetEl?.classList.remove('promise-highlight-target');
        }, 2500);
        return;
      }
    }
  }

  if (markdownTextareaRef.value) {
    const ta = markdownTextareaRef.value;
    if (quote && ta.value.includes(quote)) {
      const idx = ta.value.indexOf(quote);
      ta.focus();
      ta.setSelectionRange(idx, idx + quote.length);
      const lineCount = ta.value.substring(0, idx).split('\n').length;
      const lineHeight = 20;
      ta.scrollTop = Math.max(0, (lineCount - 3) * lineHeight);
    }
  }
};

const handleEntityInsert = (payload: { type: string; id: string; name?: string }) => {
  const url = `ui_editor.html?project=${encodeURIComponent(props.project)}&type=${encodeURIComponent(payload.type)}&id=${encodeURIComponent(payload.id)}`;
  const displayName = payload.name || payload.id;

  if (activeEditorTarget.value === 'wysiwyg' && (editorMode.value === 'wysiwyg' || editorMode.value === 'split')) {
    if (editor.value) {
      const { state } = editor.value;
      const { $from } = state.selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
      const match = /\(\(([^)]*)\)\)$/.exec(textBefore);
      if (match) {
        const start = $from.pos - match[0].length;
        const end = $from.pos;
        const finalName = match[1]?.trim() || displayName;
        editor.value.chain().focus()
          .deleteRange({ from: start, to: end })
          .insertContent(`<a href="/${url}">${finalName}</a>`)
          .run();
      } else {
        editor.value.chain().focus()
          .insertContent(`<a href="/${url}">${displayName}</a>`)
          .run();
      }
    }
  } else if (activeEditorTarget.value === 'markdown' && (editorMode.value === 'markdown' || editorMode.value === 'split')) {
    const target = markdownTextareaRef.value;
    if (target) {
      target.focus();
      const val = target.value;
      const selStart = target.selectionStart;
      const selEnd = target.selectionEnd;
      const before = val.substring(0, selStart);
      const match = /\(\(([^)]*)\)\)$/.exec(before);
      if (match) {
        const replaceStart = selStart - match[0].length;
        const finalName = match[1]?.trim() || displayName;
        const fullInsert = `((${finalName}))[${url}]`;
        target.setRangeText(fullInsert, replaceStart, selEnd, 'end');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        const fullInsert = `((${displayName}))[${url}]`;
        target.setRangeText(fullInsert, selStart, selEnd, 'end');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  // Мгновенная регистрация участника в главе
  emit('add-participant', { type: payload.type, id: payload.id, name: payload.name });
  document.dispatchEvent(new CustomEvent('ww:add-participant', { detail: { type: payload.type, id: payload.id, name: payload.name } }));
};

const props = withDefaults(defineProps<{
  project: string;
  title?: string;
  content?: string;
  hasUnsavedChanges?: boolean;
  footnotesData?: Record<string, { id: string; text: string }>;
  initialScrollPos?: number;
  changedFields?: string[];
  existingPromises?: PlotPromise[];
}>(), {
  title: '',
  content: '',
  hasUnsavedChanges: false,
  footnotesData: () => ({}),
  initialScrollPos: 0,
  changedFields: () => [],
  existingPromises: () => []
});

const emit = defineEmits([
  'update:title',
  'update:content',
  'update:footnotesData',
  'change',
  'save',
  'openEntity',
  'scroll-change',
  'toggle-history',
  'open-entity-selector',
  'add-participant',
  'create-promise',
  'link-milestone'
]);

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
    startResizeRight
} = useTiptapEditor(props, emit as (event: string, ...args: unknown[]) => void);

const currentSemanticDocument = computed<SemanticDocument>(() => {
  if (editor.value) {
    const json = editor.value.getJSON() as unknown as TiptapDocJson;
    return ASTAdapter.tiptapToSemanticAST(json, {
      id: 'chapter-doc',
      profileId: 'gost_academic',
      metadata: {
        title: props.title || 'Глава',
        authors: ['Автор'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      blocks: []
    });
  }
  return normalizeSemanticDocument({
    metadata: {
      title: props.title || 'Глава',
      authors: ['Автор'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  });
});

function openExportModal() {
  isExportModalOpen.value = true;
}

const isParagraphModalOpen = ref(false);
const isCurrentPageLandscape = ref(false);
const currentPageSize = ref<PageSize>('A4');

const applyTextAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
  if (editor.value) {
    editor.value.chain().focus().setTextAlign(align).run();
  }
};

const applyLineHeight = (lh: string) => {
  if (editor.value) {
    editor.value.chain().focus().setParagraphLineHeight(lh).run();
  }
};

const insertEquation = () => {
  if (editor.value) {
    editor.value.chain().focus().insertContent('$$f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx$$').run();
  }
};

const handleFirstLineIndentChange = (cm: number) => {
  if (editor.value) {
    editor.value.chain().focus().setParagraphIndent(cm).run();
  }
};

const handleParagraphFormatApply = (data: ParagraphFormatData) => {
  if (editor.value) {
    applyTextAlign(data.alignment);
    applyLineHeight(data.lineHeight);
    if (data.firstLineType === 'indent') {
      handleFirstLineIndentChange(data.firstLineCm);
    }
  }
};

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.altKey && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    insertEquation();
  } else if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    if (editor.value) {
      editor.value.chain().focus().insertContent('<hr class="page-break" />').run();
    }
  }
};

import { openEntityEditorWindow } from '../../../utils/windowManager';

const handleOpenEntityWindow = (e: Event) => {
  const { type, id } = (e as CustomEvent<{ type: string; id: string }>).detail;
  // We need to resolve name, but we can pass a generic one and the window will load it
  openEntityEditorWindow(props.project, type, id, id.split(':').pop() || 'Сущность');
};

const handleLocatePromiseEvent = (e: Event) => {
  const detail = (e as CustomEvent<{ chapterId?: string; paragraphIndex: number; quote?: string }>).detail;
  if (!detail) return;
  scrollToParagraph(detail.paragraphIndex, detail.quote);
};

defineExpose({
  scrollToParagraph
});

onMounted(() => {
  document.addEventListener('ww:open-entity-selector', handleOpenEntitySelector);
  document.addEventListener('ww:open-entity-window', handleOpenEntityWindow);
  document.addEventListener('ww:locate-promise', handleLocatePromiseEvent);
  window.addEventListener('keydown', handleGlobalKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('ww:open-entity-selector', handleOpenEntitySelector);
  document.removeEventListener('ww:open-entity-window', handleOpenEntityWindow);
  document.removeEventListener('ww:locate-promise', handleLocatePromiseEvent);
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>

<style src="@worldwiki/resources/styles/features/chapters/EditorCoreTiptap.css"></style>

