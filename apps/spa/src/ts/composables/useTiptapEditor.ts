import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Extension } from '@tiptap/core';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';
import Paragraph from '@tiptap/extension-paragraph';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import SemanticParagraphNode from '../components/Vue/Chapters/SemanticParagraphNode.vue';
import { settingsService } from '@worldwiki/components';
import { apiService } from '../services/api.service';

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


export function useTiptapEditor(props: any, emit: any) {

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

  return {
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
  };
}
