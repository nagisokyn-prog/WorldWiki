import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTiptapEditor } from './useTiptapEditor';
import type { EditorCoreTiptapProps, EditorCoreTiptapEmits } from './EditorCoreTiptap.model';
import type { PromiseTypeOption } from './usePromiseContextMenu';
import type { ParagraphFormatData, PageSize } from '@worldwiki/word-vibe';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import { ASTAdapter, type TiptapDocJson } from '../../../services/document/ast/ASTAdapter';
import { normalizeSemanticDocument } from '../../../services/document/ast/ASTNormalizer';
import type { SemanticDocument } from '../../../services/document/ast/types';
import { openEntityEditorWindow } from '../../../utils/windowManager';

export function useEditorCoreTiptap(
  props: EditorCoreTiptapProps,
  emit: EditorCoreTiptapEmits
) {
  const isExportModalOpen = ref(false);
  const isEntitySelectorOpen = ref(false);
  const activeEditorTarget = ref<'wysiwyg' | 'markdown'>('markdown');

  const isPromiseMenuOpen = ref(false);
  const promiseMenuPos = ref({ x: 0, y: 0 });
  const selectedPromiseData = ref<{ quote: string; paragraph_index: number; block_id?: string | null }>({
    quote: '',
    paragraph_index: 1,
    block_id: null
  });

  const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null);

  const isParagraphModalOpen = ref(false);
  const isCurrentPageLandscape = ref(false);
  const currentPageSize = ref<PageSize>('A4');

  const tiptap = useTiptapEditor(props, emit as (event: string, ...args: unknown[]) => void);

  const currentSemanticDocument = computed<SemanticDocument>(() => {
    if (tiptap.editor.value) {
      const json = tiptap.editor.value.getJSON() as unknown as TiptapDocJson;
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

  const handleOpenEntitySelector = (e: Event) => {
    const detail = (e as CustomEvent<{ target?: 'wysiwyg' | 'markdown' }>).detail;
    activeEditorTarget.value = detail?.target || 'markdown';
    isEntitySelectorOpen.value = true;
  };

  const handleContextMenu = (e: MouseEvent) => {
    let selectedText = '';
    let paragraphIndex = 1;

    if (tiptap.editorMode.value === 'wysiwyg' || tiptap.editorMode.value === 'split') {
      if (tiptap.editor.value) {
        const { selection, doc } = tiptap.editor.value.state;
        if (!selection.empty) {
          selectedText = doc.textBetween(selection.from, selection.to, ' ').trim();

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
    if (tiptap.editorMode.value === 'wysiwyg' || tiptap.editorMode.value === 'split') {
      if (tiptap.editor.value) {
        const editorDom = tiptap.editor.value.view.dom;
        const allNodes = Array.from(
          editorDom.querySelectorAll('.semantic-paragraph-node, .ProseMirror > *, p, h1, h2, h3, h4, h5, h6, blockquote, li, tr')
        ) as HTMLElement[];
        let targetEl: HTMLElement | null = null;

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

    if (activeEditorTarget.value === 'wysiwyg' && (tiptap.editorMode.value === 'wysiwyg' || tiptap.editorMode.value === 'split')) {
      if (tiptap.editor.value) {
        const { state } = tiptap.editor.value;
        const { $from } = state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        const match = /\(\(([^)]*)\)\)$/.exec(textBefore);
        if (match) {
          const start = $from.pos - match[0].length;
          const end = $from.pos;
          const finalName = match[1]?.trim() || displayName;
          tiptap.editor.value.chain().focus()
            .deleteRange({ from: start, to: end })
            .insertContent(`<a href="/${url}">${finalName}</a>`)
            .run();
        } else {
          tiptap.editor.value.chain().focus()
            .insertContent(`<a href="/${url}">${displayName}</a>`)
            .run();
        }
      }
    } else if (activeEditorTarget.value === 'markdown' && (tiptap.editorMode.value === 'markdown' || tiptap.editorMode.value === 'split')) {
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

    emit('add-participant', { type: payload.type, id: payload.id, name: payload.name });
    document.dispatchEvent(new CustomEvent('ww:add-participant', { detail: { type: payload.type, id: payload.id, name: payload.name } }));
  };

  const openExportModal = () => {
    isExportModalOpen.value = true;
  };

  const applyTextAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (tiptap.editor.value) {
      tiptap.editor.value.chain().focus().setTextAlign(align).run();
    }
  };

  const applyLineHeight = (lh: string) => {
    if (tiptap.editor.value) {
      tiptap.editor.value.chain().focus().setParagraphLineHeight(lh).run();
    }
  };

  const insertEquation = () => {
    if (tiptap.editor.value) {
      tiptap.editor.value.chain().focus().insertContent('$$f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx$$').run();
    }
  };

  const handleFirstLineIndentChange = (cm: number) => {
    if (tiptap.editor.value) {
      tiptap.editor.value.chain().focus().setParagraphIndent(cm).run();
    }
  };

  const handleParagraphFormatApply = (data: ParagraphFormatData) => {
    if (tiptap.editor.value) {
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
      if (tiptap.editor.value) {
        tiptap.editor.value.chain().focus().insertContent('<hr class="page-break" />').run();
      }
    }
  };

  const handleOpenEntityWindow = (e: Event) => {
    const { type, id } = (e as CustomEvent<{ type: string; id: string }>).detail;
    openEntityEditorWindow(props.project, type, id, id.split(':').pop() || 'Сущность');
  };

  const handleLocatePromiseEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ chapterId?: string; paragraphIndex: number; quote?: string }>).detail;
    if (!detail) return;
    scrollToParagraph(detail.paragraphIndex, detail.quote);
  };

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

  return {
    ...tiptap,
    isExportModalOpen,
    isEntitySelectorOpen,
    activeEditorTarget,
    isPromiseMenuOpen,
    promiseMenuPos,
    selectedPromiseData,
    markdownTextareaRef,
    isParagraphModalOpen,
    isCurrentPageLandscape,
    currentPageSize,
    currentSemanticDocument,
    handleOpenEntitySelector,
    handleContextMenu,
    handlePromiseSelect,
    handleMilestoneSelect,
    scrollToParagraph,
    handleEntityInsert,
    openExportModal,
    applyTextAlign,
    applyLineHeight,
    insertEquation,
    handleFirstLineIndentChange,
    handleParagraphFormatApply
  };
}
