<template>
  <div class="editor-core" style="flex: 1; display: flex; flex-direction: column; padding: 24px; overflow: hidden; min-width: 0;">
    
    <!-- Toolbar -->
    <div class="chapter-toolbar" style="padding: 12px 0; border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="toggleBold" :class="{ active: editor?.isActive('bold') }" title="Жирный (Ctrl+B)">B</button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="toggleItalic" :class="{ active: editor?.isActive('italic') }" title="Курсив (Ctrl+I)">I</button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="toggleStrike" :class="{ active: editor?.isActive('strike') }" title="Зачеркнутый">S</button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="setHeading(2)" :class="{ active: editor?.isActive('heading', { level: 2 }) }" title="Заголовок">H</button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="toggleBlockquote" :class="{ active: editor?.isActive('blockquote') }" title="Цитата">"</button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="toggleBulletList" :class="{ active: editor?.isActive('bulletList') }" title="Список">•</button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="toggleOrderedList" :class="{ active: editor?.isActive('orderedList') }" title="Нумерованный список">1.</button>
        <div v-if="editorMode !== 'markdown'" style="width: 1px; height: 24px; background: var(--border-color); margin: 0 4px;"></div>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="insertImage" title="Картинка"><i class="fas fa-image"></i></button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="insertTable" title="Таблица"><i class="fas fa-table"></i></button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="insertLink" title="Ссылка"><i class="fas fa-link"></i></button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="clearFormatting" title="Очистить формат"><i class="fas fa-eraser"></i></button>
        <button v-if="editorMode !== 'markdown'" class="toolbar-btn interactive-el" @click="insertFootnote" title="Сноска"><i class="fas fa-quote-left"></i></button>
      </div>
      
      <div class="toolbar-group" style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
        <button 
          class="link-lock-btn interactive-el" 
          @click="toggleLinkLock" 
          :class="{ 'locked': settings?.editor?.requireCtrlForLinks }"
          style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 10px; border: 2px solid var(--border-color); cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-size: 11px; font-weight: 800; background: var(--bg-secondary); color: var(--text-main); box-shadow: 0 4px 15px rgba(0,0,0,0.2);"
          :title="settings?.editor?.requireCtrlForLinks ? 'Ссылки открываются только с Ctrl' : 'Ссылки открываются обычным кликом'"
        >
          <i :class="settings?.editor?.requireCtrlForLinks ? 'fas fa-lock' : 'fas fa-lock-open'" :style="{ color: settings?.editor?.requireCtrlForLinks ? 'var(--accent)' : '#ffaa00' }"></i>
          <span :style="{ color: settings?.editor?.requireCtrlForLinks ? 'var(--accent)' : 'var(--text-main)' }">
            {{ settings?.editor?.requireCtrlForLinks ? 'LINKS: CTRL' : 'LINKS: OPEN' }}
          </span>
        </button>

        <button class="toolbar-btn interactive-el" @click="analyzeText" title="Анализ текста"><i class="fas fa-chart-bar"></i></button>
        <XboxWheel 
          class="editor-mode-wheel"
          v-model="editorMode" 
          @update:model-value="switchEditorMode" 
          :options="modeOptions" 
          style="width: 150px; flex-shrink: 0;"
        />
        <button class="btn-new interactive-el" @click="$emit('save')" :class="{ 'unsaved-glow': hasUnsavedChanges }" style="background: var(--accent); color: white; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; height: 32px; white-space: nowrap;">
          💾 {{ hasUnsavedChanges ? 'Сохранить*' : 'Сохранено' }}
        </button>
        <button class="btn-new interactive-el" @click="$emit('toggle-history')" style="background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 500; height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px;" title="История изменений">
          <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="display: inline; vertical-align: middle;"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
        </button>
      </div>
    </div>

    <!-- Title -->
    <div class="chapter-header" style="margin-bottom: 20px; position: relative;" :class="{ 'history-changed': changedFields.includes('title') }">
      <div v-if="changedFields.includes('title')" class="changed-indicator" style="position: absolute; right: -8px; top: -8px; z-index: 5;" title="Поле было изменено">
          <span style="background: var(--accent); color: white; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">Изменено</span>
      </div>
      <input type="text" :value="title" @input="updateTitle" placeholder="Название главы..." style="width: 100%; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--accent); font-size: 24px; font-weight: 700; outline: none; transition: all 0.3s; padding-bottom: 4px;" class="chapter-title-input">
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
          @input="onMarkdownInput"
          placeholder="# Напишите markdown..."
          style="flex: 1; background: #ffffff; color: #000000; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; resize: none; outline: none;"
        ></textarea>
      </div>

      <!-- Split View: Markdown + WYSIWYG + Block Structure (тонкие разделители) -->
      <div v-else-if="editorMode === 'split'" style="flex: 1; display: flex; overflow: hidden; border-radius: 8px; border: 1px solid var(--border-color);">
        
        <!-- Left: Markdown Editor -->
        <div :style="{ flex: `0 0 ${leftPanelWidth}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-color)' }">
          <div style="background: var(--bg-input); border-bottom: 1px solid var(--border-color); padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted);">✏️ Markdown</div>
          <textarea 
            v-model="markdownContent" 
            @input="onMarkdownInput"
            placeholder="# Напишите markdown..."
            style="flex: 1; background: #ffffff; color: #000000; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6; resize: none; outline: none; border: none; padding: 12px;"
          ></textarea>
        </div>

        <!-- Drag Handle Left -->
        <div 
          @mousedown="startResizeLeft"
          style="width: 6px; background: var(--border-color); cursor: col-resize; transition: background 0.2s; flex-shrink: 0;"
          @mouseover="($event.target as HTMLElement).style.background = 'var(--accent)'"
          @mouseout="($event.target as HTMLElement).style.background = 'var(--border-color)'"
          title="Потащите для изменения ширины"
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
          @mousedown="startResizeRight"
          style="width: 6px; background: var(--border-color); cursor: col-resize; transition: background 0.2s; flex-shrink: 0;"
          @mouseover="($event.target as HTMLElement).style.background = 'var(--accent)'"
          @mouseout="($event.target as HTMLElement).style.background = 'var(--border-color)'"
          title="Потащите для изменения ширины"
        ></div>

        <!-- Right: Block Structure (скрывается по Ctrl+R) -->
        <div v-if="showStructure" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-input);">
          <div style="background: rgba(255,255,255,0.1); border-bottom: 1px solid var(--border-color); padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted);">🧩 Структура (Ctrl+R)</div>
          <div style="flex: 1; overflow-y: auto; padding: 8px; border-left: 1px solid var(--border-color);">
            <div v-for="(block, idx) in documentStructure" :key="idx" style="margin-bottom: 4px; padding: 6px 8px; border-left: 2px solid var(--accent); background: rgba(139,92,246,0.1); border-radius: 3px; font-size: 11px; cursor: pointer; transition: all 0.2s; display: flex; gap: 6px; align-items: flex-start;" @click="scrollToBlock(idx)" :class="{ 'block-selected': selectedBlockIdx === idx }">
              <div v-if="block.semanticTag" @click.stop="cycleGlobalTag(block.pIndex!)" class="interactive-el" :style="block.semanticTag === 'desc' ? 'background: rgba(148,163,184,0.1); color: #94a3b8;' : block.semanticTag === 'dialog' ? 'background: rgba(56,189,248,0.1); color: #38bdf8;' : 'background: rgba(192,132,252,0.1); color: #c084fc;'" style="font-weight: 800; font-size: 9px; padding: 2px 4px; border-radius: 3px; flex-shrink: 0; cursor: pointer;">{{ block.semanticTag === 'desc' ? '!о' : block.semanticTag === 'dialog' ? '!д' : '!м' }}</div>
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
        <button @click="deleteFootnote(id as string)" style="background: none; border: none; color: #ef4444; cursor: pointer;">✕</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Extension } from '@tiptap/core';
import { settingsService } from '../../../../../tauri-surreal-kit/frontend/src/js/services/settings.service';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';
import Paragraph from '@tiptap/extension-paragraph';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import SemanticParagraphNode from './SemanticParagraphNode.vue';
import XboxWheel from '../../../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue';

// @ts-ignore
declare module 'turndown';
// @ts-ignore
declare module 'markdown-it';

import { apiService } from '../../../services/api.service';

// Расширение для обработки Enter/Shift+Enter и Ctrl+Q
const EnterHandler = Extension.create({
  name: 'enterHandler',
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        // Enter создает новый параграф (поведение по-умолчанию)
        return false; // Разрешить стандартную обработку
      },
      'Shift-Enter': ({ editor }) => {
        // Shift+Enter создает hard break (перевод строки внутри параграфа)
        return editor.commands.setHardBreak();
      },
      'Mod-q': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        const match = textBefore.match(/\[([^\]]+)\]$/);
        
        if (match) {
          const name = match[1].trim();
          const startPos = $from.pos - match[0].length;
          const endPos = $from.pos;
          
          // Эмитим событие, которое мы перехватим в setup
          document.dispatchEvent(new CustomEvent('ww:quick-link', { detail: { name, startPos, endPos } }));
          return true;
        }
        return false;
      }
    };
  },
});

const SemanticParagraph = Paragraph.extend({
  addAttributes() {
    return {
      semanticTag: {
        default: 'desc',
        parseHTML: element => element.getAttribute('data-semantic-tag'),
        renderHTML: attributes => {
          return {
            'data-semantic-tag': attributes.semanticTag,
          }
        },
      },
    }
  },
  addNodeView() {
    return VueNodeViewRenderer(SemanticParagraphNode);
  }
});

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

const modeOptions = [
  { value: 'wysiwyg', label: '📝 WYSIWYG' },
  { value: 'markdown', label: '✏️ Markdown' },
  { value: 'split', label: '📑 Split View' }
];

const getStateKey = () => `editor-state-${props.project}-${props.title}`.replace(/[^a-zA-Z0-9_-]/g, '_');

const loadInitialMode = (): 'wysiwyg' | 'markdown' | 'split' => {
  const saved = localStorage.getItem(getStateKey());
  if (saved) {
    try {
      const { mode } = JSON.parse(saved);
      if (mode === 'wysiwyg' || mode === 'markdown' || mode === 'split') {
        return mode;
      }
    } catch (e) {}
  }
  return (localStorage.getItem('default-editor-mode') as 'wysiwyg' | 'markdown' | 'split') || 'wysiwyg';
};

const editorMode = ref<'wysiwyg' | 'markdown' | 'split'>(loadInitialMode());
const settings = ref(settingsService.getSettings());
const editorUpdateKey = ref(0);
const wordCount = ref(0);
const charCount = ref(0);
const footnotes = ref<Record<string, {id: string, text: string}>>({});
const ctrlPressed = ref(false);
const markdownContent = ref('');
const selectedBlockIdx = ref(-1);
const showStructure = ref(localStorage.getItem('split-view-show-structure') !== 'false');
const leftPanelWidth = ref(40); // percentage
const rightPanelWidth = ref(35); // percentage
const resizing = ref<'left' | 'middle' | null>(null);

const turndownService = new TurndownService();
turndownService.addRule('denseParagraph', {
  filter: 'p',
  replacement: function (content) {
    return '\n' + content + '\n';
  }
});
const mdIt = new MarkdownIt();

const savePositionState = () => {
  let cursor = 0;
  let scroll = 0;
  
  if (editorMode.value === 'markdown') {
    const ta = document.querySelector('textarea') as HTMLTextAreaElement;
    if (ta) {
      cursor = ta.selectionStart || 0;
      scroll = ta.scrollTop || 0;
    }
  } else {
    if (editor.value) cursor = editor.value.state.selection.anchor;
    
    if (editorMode.value === 'wysiwyg') {
      const wrapper = document.querySelector('.editor-wrapper') as HTMLElement;
      if (wrapper) scroll = wrapper.scrollTop;
    } else if (editorMode.value === 'split') {
      const wrapper = document.querySelector('.editor-content-split')?.parentElement as HTMLElement;
      if (wrapper) scroll = wrapper.scrollTop;
    }
  }
  
  localStorage.setItem(getStateKey(), JSON.stringify({ cursor, scroll, mode: editorMode.value }));
};

const restorePositionState = () => {
  const saved = localStorage.getItem(getStateKey());
  if (saved) {
    try {
      const { cursor, scroll } = JSON.parse(saved);
      
      if (editorMode.value === 'markdown') {
        setTimeout(() => {
          const ta = document.querySelector('textarea') as HTMLTextAreaElement;
          if (ta) {
            if (cursor !== undefined) {
              ta.setSelectionRange(cursor, cursor);
              ta.focus();
            }
            if (scroll !== undefined) ta.scrollTop = scroll;
          }
        }, 150);
      } else {
        if (cursor !== undefined && editor.value) {
          editor.value.commands.setTextSelection(cursor);
        }
        if (scroll !== undefined) {
          setTimeout(() => {
            if (editorMode.value === 'wysiwyg') {
              const wrapper = document.querySelector('.editor-wrapper') as HTMLElement;
              if (wrapper) wrapper.scrollTop = scroll;
            } else if (editorMode.value === 'split') {
              const wrapper = document.querySelector('.editor-content-split')?.parentElement as HTMLElement;
              if (wrapper) wrapper.scrollTop = scroll;
            }
          }, 150);
        }
      }
    } catch (e) {
      console.error('Failed to restore position', e);
    }
  } else if (props.initialScrollPos) {
    setTimeout(() => {
      const wrapper = document.querySelector('.editor-wrapper') as HTMLElement;
      if (wrapper) wrapper.scrollTop = props.initialScrollPos;
    }, 150);
  }
};

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  savePositionState();
  if (props.hasUnsavedChanges) {
    emit('save');
  }
};

// Document structure for Split View
const documentStructure = computed(() => {
  editorUpdateKey.value; // Track dependency
  if (!editor.value) return [];
  const doc = editor.value.getJSON();
  const blocks: Array<{ type: string; text: string; level?: number; semanticTag?: string; pIndex?: number }> = [];
  
  let pIndexCounter = 0;
  
  function traverse(node: any, depth = 0) {
    if (!node) return;
    
    if (Array.isArray(node)) {
      node.forEach(n => traverse(n, depth));
    } else if (node.type) {
      let text = '';
      let type = node.type;
      
      // Extract text from node
      if (node.content) {
        node.content.forEach((c: any) => {
          if (c.type === 'text' && c.text) text += c.text;
        });
      }
      
      // Shorten long text
      text = text.substring(0, 60);
      if (text.length === 60) text += '...';
      
      // Add to structure based on type
      if (type === 'heading') {
        blocks.push({ type: `H${node.attrs?.level || 1}`, text, level: node.attrs?.level });
      } else if (type === 'paragraph') {
        blocks.push({ type: 'Paragraph', text, semanticTag: node.attrs?.semanticTag || 'desc', pIndex: pIndexCounter });
        pIndexCounter++;
      } else if (type === 'bulletList' || type === 'orderedList') {
        blocks.push({ type: type === 'bulletList' ? 'List' : 'Ordered', text: `(${node.content?.length || 0} items)` });
      } else if (type === 'blockquote') {
        blocks.push({ type: 'Quote', text });
      } else if (type === 'codeBlock') {
        blocks.push({ type: 'Code', text });
      } else if (type === 'table') {
        blocks.push({ type: 'Table', text: `(${node.content?.length || 0} rows)` });
      }
      
      // Traverse children
      if (node.content) {
        node.content.forEach((c: any) => traverse(c, depth + 1));
      }
    }
  }
  
  if (doc.content) traverse(doc);
  return blocks;
});



const editor = useEditor({
  extensions: [
    StarterKit.configure({
      paragraph: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
      },
    }),
    SemanticParagraph,
    Image.configure({
      allowBase64: true,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    EnterHandler,
  ],
  content: props.content || '',
  onUpdate: ({ editor }) => {
    const html = editor.getHTML();
    emit('update:content', html);
    emit('change');
    updateStats();
    syncMarkdownFromEditor();
    editorUpdateKey.value++;
  },
});

const updateTitle = (e: Event) => {
  emit('update:title', (e.target as HTMLInputElement).value);
  emit('change');
};

const updateStats = () => {
  if (!editor.value) return;
  const content = editor.value.getText();
  charCount.value = content.length;
  const words = content.trim().split(/\s+/).filter((w: string) => w.length > 0);
  wordCount.value = words.length;
};

const preprocessMarkdown = (text: string) => {
  const lines = text.split('\n');
  let inCode = false;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) inCode = !inCode;
    out.push(line);
    
    if (!inCode && i < lines.length - 1) {
      const nextLine = lines[i+1];
      if (line.trim() !== '' && nextLine.trim() !== '') {
        const isCurrentQuote = line.trim().startsWith('>');
        const isNextQuote = nextLine.trim().startsWith('>');
        const isSoftBreak = line.endsWith('  ') || line.endsWith('\\');
        
        if (!isSoftBreak && !(isCurrentQuote && isNextQuote)) {
          out.push('');
        }
      }
    }
  }
  return out.join('\n');
};

// Sync markdown to editor when markdown is edited
const onMarkdownInput = () => {
  try {
    const processed = preprocessMarkdown(markdownContent.value);
    const html = mdIt.render(processed);
    if (editor.value) {
      editor.value.commands.setContent(html);
    }
    emit('update:content', html);
    emit('change');
    updateStats();
  } catch (err) {
    console.error('Markdown parse error:', err);
  }
};

// Sync markdown from editor when WYSIWYG is edited
const syncMarkdownFromEditor = () => {
  if (!editor.value) return;
  const html = editor.value.getHTML();
  try {
    markdownContent.value = turndownService.turndown(html);
  } catch (err) {
    console.log('Turndown error (non-critical):', err);
  }
};

// Toolbar actions for WYSIWYG
const toggleBold = () => editor.value?.chain().focus().toggleBold().run();
const toggleItalic = () => editor.value?.chain().focus().toggleItalic().run();
const toggleStrike = () => editor.value?.chain().focus().toggleStrike().run();
const setHeading = (level: number) => editor.value?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
const toggleBlockquote = () => editor.value?.chain().focus().toggleBlockquote().run();
const toggleBulletList = () => editor.value?.chain().focus().toggleBulletList().run();
const toggleOrderedList = () => editor.value?.chain().focus().toggleOrderedList().run();

const insertImage = () => {
  const url = prompt('URL изображения:');
  if (url && editor.value) {
    editor.value.chain().focus().setImage({ src: url }).run();
  }
};

const insertLink = () => {
  const text = prompt('Текст ссылки:', 'ссылка');
  const url = prompt('URL:');
  if (text && url && editor.value) {
    editor.value.chain().focus().setLink({ href: url }).insertContent(text).run();
  }
};

const insertTable = () => {
  if (!editor.value) return;
  editor.value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
};

const clearFormatting = () => {
  if (!editor.value) return;
  editor.value.chain().focus().clearNodes().unsetLink().run();
};

const insertFootnote = () => {
  const text = prompt('Введите текст сноски:');
  if (!text || !editor.value) return;
  const id = `fn${Object.keys(footnotes.value).length + 1}`;
  footnotes.value[id] = { id, text };
  editor.value.chain().focus().insertContent(`[^${id}]`).run();
  emit('update:footnotesData', footnotes.value);
  emit('change');
};

const deleteFootnote = (id: string) => {
  if (confirm('Удалить сноску?')) {
    delete footnotes.value[id];
    emit('update:footnotesData', footnotes.value);
    emit('change');
  }
};

const switchEditorMode = () => {
  if (editorMode.value === 'markdown' || editorMode.value === 'split') {
    syncMarkdownFromEditor();
  }
  localStorage.setItem('default-editor-mode', editorMode.value);
  savePositionState();
};

const toggleLinkLock = () => {
  const newS = JSON.parse(JSON.stringify(settings.value));
  if (!newS.editor) newS.editor = {};
  newS.editor.requireCtrlForLinks = !newS.editor.requireCtrlForLinks;
  settingsService.saveSettings(newS);
};

const analyzeText = () => {
  if (!editor.value) return;
  const text = editor.value.getText();
  console.log('Text analysis:', {
    chars: text.length,
    words: text.trim().split(/\s+/).filter(w => w.length > 0).length,
    paragraphs: text.split(/\n\n+/).filter(p => p.trim()).length,
    blocks: documentStructure.value.length
  });
};

const handleScroll = (e: Event) => {
  const scrollPos = (e.target as HTMLElement).scrollTop;
  emit('scroll-change', scrollPos);
};

const scrollToBlock = (idx: number) => {
  selectedBlockIdx.value = idx;
};

const cycleGlobalTag = (pIndex: number) => {
  if (!editor.value) return;
  
  let currentPIndex = 0;
  let targetPos = -1;
  let targetNode: any = null;
  
  editor.value.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') {
      if (currentPIndex === pIndex) {
        targetPos = pos;
        targetNode = node;
        return false;
      }
      currentPIndex++;
    }
  });
  
  if (targetPos !== -1 && targetNode) {
    const currentTag = targetNode.attrs.semanticTag || 'desc';
    const nextTag = currentTag === 'desc' ? 'dialog' : (currentTag === 'dialog' ? 'thought' : 'desc');
    
    editor.value.view.dispatch(
      editor.value.state.tr.setNodeMarkup(targetPos, undefined, {
        ...targetNode.attrs,
        semanticTag: nextTag
      })
    );
    editorUpdateKey.value++;
    emit('change');
  }
};

// Resizing функционал для Split View
const startResizeLeft = (e: MouseEvent) => {
  e.preventDefault();
  resizing.value = 'left';
  const container = (e.currentTarget as HTMLElement).parentElement;
  if (!container) return;
  
  const startX = e.clientX;
  const startLeftWidth = leftPanelWidth.value;
  const containerWidth = container.offsetWidth;
  
  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newLeftWidth = Math.max(20, Math.min(60, startLeftWidth + deltaPercent));
    leftPanelWidth.value = newLeftWidth;
  };
  
  const onMouseUp = () => {
    resizing.value = null;
    localStorage.setItem('split-view-left-width', leftPanelWidth.value.toString());
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const startResizeRight = (e: MouseEvent) => {
  e.preventDefault();
  resizing.value = 'middle';
  const container = (e.currentTarget as HTMLElement).parentElement;
  if (!container) return;
  
  const startX = e.clientX;
  const startRightWidth = rightPanelWidth.value;
  const containerWidth = container.offsetWidth;
  
  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newRightWidth = Math.max(20, Math.min(60, startRightWidth + deltaPercent));
    rightPanelWidth.value = newRightWidth;
  };
  
  const onMouseUp = () => {
    resizing.value = null;
    localStorage.setItem('split-view-right-width', rightPanelWidth.value.toString());
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// Watchers
watch(() => props.content, (newContent) => {
  if (editor.value && editor.value.getHTML() !== newContent) {
    editor.value.commands.setContent(newContent || '');
    updateStats();
    syncMarkdownFromEditor();
  }
});

watch(() => props.footnotesData, (newFootnotes) => {
  footnotes.value = { ...newFootnotes };
});

// Link handling
let handleLinkInteraction: ((e: MouseEvent) => void) | null = null;
let downHandler: ((e: KeyboardEvent) => void) | null = null;
let upHandler: ((e: KeyboardEvent) => void) | null = null;
let handleToggleStructure: (() => void) | null = null;

onMounted(() => {
  settingsService.onChange((newS) => { settings.value = newS; });
  updateStats();
  syncMarkdownFromEditor();
  
  setTimeout(() => restorePositionState(), 100);
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  downHandler = (e: KeyboardEvent) => { 
    if (e.key === 'Control' || e.key === 'Meta') ctrlPressed.value = true;
    
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      savePositionState();
      emit('save');
      setTimeout(() => window.location.reload(), 300);
      return;
    }

    // Ctrl+Alt+B - скрыть/показать правую панель
    if (e.ctrlKey && e.altKey && e.code === 'KeyB' && !e.shiftKey) {
      console.log('[EditorCore] Ctrl+Alt+B pressed');
      e.preventDefault();
      const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
      localStorage.setItem('chapters-right-panel-visible', (!isHidden).toString());
      document.dispatchEvent(new CustomEvent('ww:toggle-right-panel'));
    }
  };
  upHandler = (e: KeyboardEvent) => { if (e.key === 'Control' || e.key === 'Meta') ctrlPressed.value = false; };
  
  document.addEventListener('keydown', downHandler);
  document.addEventListener('keyup', upHandler);
  window.addEventListener('blur', () => ctrlPressed.value = false);
  
  // Слушатель для toggle структуры от app.ts или других компонентов
  handleToggleStructure = () => {
    const storedValue = localStorage.getItem('split-view-show-structure');
    const shouldShow = storedValue !== 'false'; // 'true' или null = показать, 'false' = скрыть
    showStructure.value = shouldShow;
    console.log('[EditorCore EVENT] ww:toggle-structure - showStructure now:', showStructure.value);
  };
  document.addEventListener('ww:toggle-structure', handleToggleStructure);
  
  // Обработчик Ctrl+Q (ww:quick-link)
  const handleQuickLink = async (e: Event) => {
    const { name, startPos, endPos } = (e as CustomEvent).detail;
    if (!name || !editor.value) return;
    
    try {
      const response = await apiService.searchEntities(props.project, name);
      if (response && response.length > 0) {
        const entity = response[0];
        const url = `?type=${entity._type}&id=${entity.id}`;
        
        editor.value.chain()
          .focus()
          .deleteRange({ from: startPos, to: endPos })
          .insertContent(`<a href="${url}">${name}</a>`)
          .run();
          
        console.log(`[EditorCore] Created quick link for ${name} -> ${entity.id}`);
      } else {
        alert(`Сущность "${name}" не найдена.`);
      }
    } catch (err) {
      console.error('[EditorCore] Quick link search error:', err);
      alert(`Ошибка при поиске сущности "${name}"`);
    }
  };
  document.addEventListener('ww:quick-link', handleQuickLink);
  
  // Загрузить сохранённые ширины панелей
  const savedLeftWidth = localStorage.getItem('split-view-left-width');
  const savedRightWidth = localStorage.getItem('split-view-right-width');
  if (savedLeftWidth) leftPanelWidth.value = parseFloat(savedLeftWidth);
  if (savedRightWidth) rightPanelWidth.value = parseFloat(savedRightWidth);
  
  handleLinkInteraction = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a');
    if (!link) return;

    let url = link.getAttribute('href') || link.getAttribute('data-href') || '';
    if (!url) return;

    console.log('[EditorCore] Link clicked:', url);
    
    if (url && (url.includes('type=') || url.includes('id='))) {
      const isLocked = settings.value?.editor?.requireCtrlForLinks ?? false;
      const isCtrlPressed = e.ctrlKey || e.metaKey || ctrlPressed.value;

      if (isLocked && !isCtrlPressed) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      
      try {
        const queryStart = url.indexOf('?');
        if (queryStart === -1) return;
        
        const queryString = url.substring(queryStart + 1);
        const params = new URLSearchParams(queryString);
        const type = params.get('type');
        const id = params.get('id');

        if (type && id) {
          emit('openEntity', { type, id });
        }
      } catch(err) {
        console.error('[EditorCore] Link parse error:', err);
      }
    }
  };

  document.addEventListener('click', handleLinkInteraction, true);
});

onUnmounted(() => {
  if (handleLinkInteraction) document.removeEventListener('click', handleLinkInteraction, true);
  if (downHandler) document.removeEventListener('keydown', downHandler);
  if (upHandler) document.removeEventListener('keyup', upHandler);
  if (handleToggleStructure) document.removeEventListener('ww:toggle-structure', handleToggleStructure);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  savePositionState();
  editor.value?.destroy();
});
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

