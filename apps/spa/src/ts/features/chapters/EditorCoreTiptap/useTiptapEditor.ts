import { onMounted, onUnmounted, watch, ref } from 'vue';
import { useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Extension } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import Paragraph from '@tiptap/extension-paragraph';
import SemanticParagraphNode from '../Semantic/SemanticParagraphNode.vue';
import * as api from '../../../services/api.client';
import { AiGhostTextExtension } from './AiGhostTextExtension';
import { settingsService } from '@worldwiki/components';
import type { AppSettings } from '@worldwiki/components';
import { useTiptapState } from './hooks/useTiptapState';
import { useTiptapMarkdown } from './hooks/useTiptapMarkdown';
import { useTiptapSplitView } from './hooks/useTiptapSplitView';
import { useTiptapFormatting } from './hooks/useTiptapFormatting';

const EnterHandler = Extension.create({
  name: 'enterHandler',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        return false;
      },
      'Shift-Enter': ({ editor }) => {
        return editor.commands.setHardBreak();
      },
      'Mod-q': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        if (/\(\([^)]+\)\)$/.test(textBefore)) {
          document.dispatchEvent(new CustomEvent('ww:open-entity-selector', { detail: { target: 'wysiwyg' } }));
          return true;
        }
        return false;
      },
      'Mod-й': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        if (/\(\([^)]+\)\)$/.test(textBefore)) {
          document.dispatchEvent(new CustomEvent('ww:open-entity-selector', { detail: { target: 'wysiwyg' } }));
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

export interface TiptapEditorProps {
  content?: string;
  footnotesData?: Record<string, { id: string; text: string }>;
  hasUnsavedChanges?: boolean;
  project: string;
  title?: string;
  initialScrollPos?: number;
  isLocked?: boolean;
  [key: string]: unknown;
}

export function useTiptapEditor(
  props: TiptapEditorProps,
  emit: (event: string, ...args: unknown[]) => void
) {
  const editorUpdateKey = ref(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['entity', 'http', 'https', 'ftp', 'mailto']
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
      AiGhostTextExtension.configure({
        projectId: props.project,
      }),
    ],
    content: props.content || '',
    onUpdate: () => {
      if (editor.value) {
        emit('update:content', editor.value.getHTML());
        emit('change');
        stateHook.updateStats();
        mdHook.syncMarkdownFromEditor();
      }
    },
  });

  const splitHook = useTiptapSplitView(editor, editorUpdateKey);
  const stateHook = useTiptapState(props, emit, editor, editorUpdateKey, splitHook.documentStructure);
  const mdHook = useTiptapMarkdown(editor, emit, stateHook.updateStats);
  const formatHook = useTiptapFormatting(editor, emit, editorUpdateKey);

  const updateTitle = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    emit('update:title', val);
    emit('change');
  };

  const handleScroll = (e: Event) => {
    emit('scroll-change', (e.target as HTMLElement).scrollTop);
  };

  watch(() => props.content, (newContent) => {
    if (editor.value && editor.value.getHTML() !== newContent) {
      editor.value.commands.setContent(newContent || '');
      stateHook.updateStats();
      mdHook.syncMarkdownFromEditor();
    }
  });

  watch(() => props.footnotesData, (newFootnotes) => {
    formatHook.footnotes.value = { ...(newFootnotes || {}) };
  });

  let handleLinkInteraction: ((e: MouseEvent) => void) | null = null;
  let downHandler: ((e: KeyboardEvent) => void) | null = null;
  let upHandler: ((e: KeyboardEvent) => void) | null = null;
  let handleToggleStructure: (() => void) | null = null;
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    const startAutoSave = () => {
      if (autoSaveTimer) clearInterval(autoSaveTimer);
      const interval = stateHook.settings.value?.editor?.autoSaveInterval;
      if (interval && interval > 0) {
        autoSaveTimer = setInterval(() => {
          if (props.hasUnsavedChanges) emit('save');
        }, interval * 1000);
      }
    };

    settingsService.onChange((newS: AppSettings) => { 
      stateHook.settings.value = newS; 
      startAutoSave();
    });
    
    startAutoSave();
    stateHook.updateStats();
    mdHook.syncMarkdownFromEditor();
    
    setTimeout(() => stateHook.restorePositionState(), 100);
    window.addEventListener('beforeunload', stateHook.handleBeforeUnload);
    
    downHandler = (e: KeyboardEvent) => { 
      if (e.key === 'Control' || e.key === 'Meta') stateHook.ctrlPressed.value = true;
      
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        stateHook.savePositionState();
        emit('save');
        setTimeout(() => window.location.reload(), 300);
        return;
      }
  
      if (e.ctrlKey && e.altKey && e.code === 'KeyB' && !e.shiftKey) {
        e.preventDefault();
        const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
        localStorage.setItem('chapters-right-panel-visible', (!isHidden).toString());
        document.dispatchEvent(new CustomEvent('ww:toggle-right-panel'));
      }
    };
    upHandler = (e: KeyboardEvent) => { if (e.key === 'Control' || e.key === 'Meta') stateHook.ctrlPressed.value = false; };
    
    document.addEventListener('keydown', downHandler);
    document.addEventListener('keyup', upHandler);
    window.addEventListener('blur', () => stateHook.ctrlPressed.value = false);
    
    handleToggleStructure = () => {
      const storedValue = localStorage.getItem('split-view-show-structure');
      splitHook.showStructure.value = storedValue !== 'false';
    };
    document.addEventListener('ww:toggle-structure', handleToggleStructure);
    
    const handleQuickLink = async (e: Event) => {
      const { name, startPos, endPos } = (e as CustomEvent).detail;
      if (!name || !editor.value) return;
      
      try {
        const response = await api.searchEntities(props.project, name, null);
        if (response && response.length > 0) {
          const entity = response[0];
          const url = `?type=${entity.entity_type}&id=${entity.id}`;
          
          editor.value.chain()
            .focus()
            .deleteRange({ from: startPos, to: endPos })
            .insertContent(`<a href="${url}">${name}</a>`)
            .run();
        } else {
          const { appAlert } = await import('@worldwiki/components');
          appAlert(`Сущность "${name}" не найдена.`);
        }
      } catch {
        const { appAlert } = await import('@worldwiki/components');
        appAlert(`Ошибка при поиске сущности "${name}"`);
      }
    };
    document.addEventListener('ww:quick-link', handleQuickLink);
    
    handleLinkInteraction = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a');
      if (!link) return;
  
      const url = link.getAttribute('href') || link.getAttribute('data-href') || '';
      if (!url) return;
      if (url && (url.includes('type=') || url.includes('id=') || url.startsWith('entity://'))) {
        const isLocked = props.isLocked !== undefined ? props.isLocked : true; // Always require Ctrl for links unless unlocked
        const isCtrlPressed = e.ctrlKey || e.metaKey || stateHook.ctrlPressed.value;
  
        if (isLocked && !isCtrlPressed) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
  
        e.preventDefault();
        e.stopPropagation();
        
        try {
          let type: string | null = null;
          let id: string | null = null;
          let project = 'default';

          if (url.includes('ui_editor.html')) {
            const urlObj = new URL(url, window.location.origin);
            project = urlObj.searchParams.get('project') || 'default';
            type = urlObj.searchParams.get('type');
            id = urlObj.searchParams.get('id');
            const name = link.textContent || 'Сущность';

            if (project && type && id) {
              import('../../../utils/windowManager').then(({ openEntityEditorWindow }) => {
                openEntityEditorWindow(project, type as string, id as string, name);
              });
            }
            return;
          } else if (url.startsWith('entity://')) {
            const parts = url.replace('entity://', '').split('/');
            type = parts[0];
            id = parts.slice(1).join('/');
          } else {
            const queryStart = url.indexOf('?');
            if (queryStart !== -1) {
              const queryString = url.substring(queryStart + 1);
              const params = new URLSearchParams(queryString);
              type = params.get('type');
              id = params.get('id');
            }
          }
  
          if (type && id) {
            if (isCtrlPressed) {
              document.dispatchEvent(new CustomEvent('ww:open-entity-window', { detail: { type, id } }));
            } else {
              emit('openEntity', { type, id });
            }
          }
        } catch(err) {
          console.error('[EditorCore] Link parse error:', err);
        }
      }
    };
  
    document.addEventListener('click', handleLinkInteraction, true);
  });
  
  onUnmounted(() => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    if (handleLinkInteraction) document.removeEventListener('click', handleLinkInteraction, true);
    if (downHandler) document.removeEventListener('keydown', downHandler);
    if (upHandler) document.removeEventListener('keyup', upHandler);
    if (handleToggleStructure) document.removeEventListener('ww:toggle-structure', handleToggleStructure);
    window.removeEventListener('beforeunload', stateHook.handleBeforeUnload);
    stateHook.savePositionState();
    editor.value?.destroy();
  });
  
  return {
    editor,
    editorUpdateKey,
    updateTitle,
    handleScroll,
    ...splitHook,
    ...stateHook,
    ...mdHook,
    ...formatHook,
    switchEditorMode: (newMode: 'wysiwyg' | 'markdown' | 'split') => {
      stateHook.switchEditorMode(newMode, mdHook.syncMarkdownFromEditor);
    }
  };
}