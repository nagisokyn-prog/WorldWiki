import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTiptapEditor } from './useTiptapEditor';
import type { EditorCoreTiptapProps, EditorCoreTiptapEmits } from './EditorCoreTiptap.model';
import { ASTAdapter, type TiptapDocJson } from '@/services/document/ast/ASTAdapter';
import { normalizeSemanticDocument } from '@/services/document/ast/ASTNormalizer';
import type { SemanticDocument } from '@/services/document/ast/types';
import { openEntityEditorWindow } from '@/utils/windowManager';
import { useEditorPromiseMenu } from './hooks/useEditorPromiseMenu';
import { useEditorWordBridge } from './hooks/useEditorWordBridge';

export function useEditorCoreTiptap(
  props: EditorCoreTiptapProps,
  emit: EditorCoreTiptapEmits
) {
  const isExportModalOpen = ref(false);
  const isEntitySelectorOpen = ref(false);
  const entitySelectorQuery = ref('');
  const activeEditorTarget = ref<'wysiwyg' | 'markdown'>('markdown');
  const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null);

  const tiptap = useTiptapEditor(props, emit as (event: string, ...args: unknown[]) => void);

  const wordBridge = useEditorWordBridge({
    editor: tiptap.editor,
    emit: emit as (event: string, ...args: unknown[]) => void,
    syncMarkdownFromEditor: tiptap.syncMarkdownFromEditor,
    updateStats: tiptap.updateStats
  });

  const promiseMenu = useEditorPromiseMenu({
    editorMode: tiptap.editorMode,
    editor: tiptap.editor,
    markdownTextareaRef,
    onOpenPromiseCreateModal: (payload) => {
      emit('create-promise', {
        kind: payload.kind || 'scene',
        quote: payload.quote,
        paragraph_index: payload.paragraph_index,
        block_id: payload.block_id
      });
    },
    onLinkMilestone: (payload) => {
      emit('link-milestone', {
        promiseId: payload.promiseId,
        stage: payload.stage || 'progression',
        quote: payload.quote,
        paragraph_index: payload.paragraph_index,
        block_id: payload.block_id
      });
    }
  });

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
    const detail = (e as CustomEvent<{ target?: 'wysiwyg' | 'markdown'; query?: string }>).detail;
    activeEditorTarget.value = detail?.target || 'markdown';
    entitySelectorQuery.value = detail?.query || '';
    isEntitySelectorOpen.value = true;
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

  const scrollToParagraph = (paragraphIndex: number, quote?: string, blockId?: string) => {
    if (tiptap.editorMode.value === 'wysiwyg' || tiptap.editorMode.value === 'split') {
      if (tiptap.editor.value) {
        const editorDom = tiptap.editor.value.view.dom;
        const targetElements: HTMLElement[] = [];

        // 1. Поиск по blockId (если указан)
        if (blockId && blockId.trim()) {
          const safeId = blockId.trim();
          try {
            const el = editorDom.querySelector(`[data-block-id="${safeId}"], [data-id="${safeId}"]`) as HTMLElement | null;
            if (el) {
              targetElements.push(el);
            }
          } catch (err) {
            console.warn('[useEditorCoreTiptap] Failed to query block selector for ID:', safeId, err);
          }
        }

        // 2. Поиск по цитате (поддержка многострочных сцен, диалогов, тире и кавычек)
        if (targetElements.length === 0 && quote && quote.trim()) {
          const cleanString = (s: string) => s.replace(/[«»""'']/g, '').replace(/[—–−-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          const normQuote = cleanString(quote);

          // Разбиваем цитату на фразы / реплики диалога
          const quotePhrases = quote
            .split(/[\r\n]+|[.!?—–]+\s+/)
            .map(cleanString)
            .filter(p => p.length > 5);

          const topBlocks = Array.from(editorDom.querySelectorAll(':scope > *, .semantic-paragraph-node, p, blockquote, h1, h2, h3')) as HTMLElement[];
          const uniqueTopBlocks = Array.from(new Set(topBlocks));

          for (const el of uniqueTopBlocks) {
            const elText = cleanString(el.textContent || '');
            if (!elText || elText.length < 3) continue;

            const isExactMatch = normQuote.length > 5 && (normQuote.includes(elText) || elText.includes(normQuote));
            const isPhraseMatch = quotePhrases.some(phrase => phrase.length > 5 && (elText.includes(phrase) || phrase.includes(elText)));

            if (isExactMatch || isPhraseMatch) {
              if (!targetElements.includes(el)) {
                targetElements.push(el);
              }
            }
          }
        }

        // 3. Fallback: по порядковому номеру абзаца
        if (targetElements.length === 0) {
          const topBlocks = Array.from(editorDom.children) as HTMLElement[];
          if (topBlocks.length > 0) {
            const idx = Math.max(0, Math.min(topBlocks.length - 1, paragraphIndex - 1));
            const el = topBlocks[idx] || null;
            if (el) targetElements.push(el);
          }
        }

        if (targetElements.length > 0) {
          const firstTarget = targetElements[0];
          const wrapper = (editorDom.closest('.editor-wrapper') || editorDom.parentElement) as HTMLElement | null;
          if (wrapper && wrapper.scrollHeight > wrapper.clientHeight) {
            const wrapperRect = wrapper.getBoundingClientRect();
            const targetRect = firstTarget.getBoundingClientRect();
            const offsetTop = targetRect.top - wrapperRect.top + wrapper.scrollTop;
            wrapper.scrollTo({
              top: Math.max(0, offsetTop - wrapper.clientHeight / 2 + targetRect.height / 2),
              behavior: 'smooth'
            });
          } else {
            firstTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }

          // Рамка-обрамление и подсветка для ВСЕХ абзацев выделенной сцены
          const prevFrames = editorDom.querySelectorAll('.scene-selected-frame');
          prevFrames.forEach(f => f.classList.remove('scene-selected-frame'));

          for (const el of targetElements) {
            el.classList.remove('promise-highlight-target');
            el.classList.add('scene-selected-frame');
          }
          requestAnimationFrame(() => {
            for (const el of targetElements) {
              el.classList.add('promise-highlight-target');
              setTimeout(() => {
                el.classList.remove('promise-highlight-target');
              }, 3000);
            }
          });
        }
      }
    }
  };

  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      if (tiptap.editor.value) {
        tiptap.editor.value.chain().focus().insertContent('$$f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx$$').run();
      }
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
    const detail = (e as CustomEvent<{ chapterId?: string; paragraphIndex: number; quote?: string; blockId?: string; block_id?: string }>).detail;
    if (!detail) return;
    scrollToParagraph(detail.paragraphIndex, detail.quote, detail.blockId || detail.block_id);
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
    ...wordBridge,
    ...promiseMenu,
    isExportModalOpen,
    isEntitySelectorOpen,
    entitySelectorQuery,
    activeEditorTarget,
    markdownTextareaRef,
    currentSemanticDocument,
    handleOpenEntitySelector,
    scrollToParagraph,
    handleEntityInsert,
    getEditor: () => tiptap.editor.value,
    setMarkdownTextarea: (el: HTMLTextAreaElement | null) => {
      markdownTextareaRef.value = el;
    },
    openExportModal: () => { isExportModalOpen.value = true; }
  };
}
