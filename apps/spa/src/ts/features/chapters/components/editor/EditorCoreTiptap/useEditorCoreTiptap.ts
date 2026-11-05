import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTiptapEditor } from './useTiptapEditor';
import type { EditorCoreTiptapProps, EditorCoreTiptapEmits } from './EditorCoreTiptap.model';
import { ASTAdapter, type TiptapDocJson } from '@/services/document/ast/ASTAdapter';
import { normalizeSemanticDocument } from '@/services/document/ast/ASTNormalizer';
import type { SemanticDocument } from '@/services/document/ast/types';
import { openEntityEditorWindow } from '@/utils/windowManager';
import { useEditorPromiseMenu } from './composables/useEditorPromiseMenu';
import { useEditorWordBridge } from './composables/useEditorWordBridge';
import { useEditorSceneFrames } from './composables/useEditorSceneFrames';

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
        const match = /\(\(([^)]*)\)\)$/.exec(textBefore) || /\(\(([^)]*)$/.exec(textBefore);
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
        const after = val.substring(selEnd);
        
        let match = /\(\(([^)]*)\)\)$/.exec(before);
        let replaceStart = selStart;
        let replaceEnd = selEnd;
        let finalName = displayName;

        if (match) {
          replaceStart = selStart - match[0].length;
          finalName = match[1]?.trim() || displayName;
        } else {
          match = /\(\(([^)]*)$/.exec(before);
          if (match) {
            replaceStart = selStart - match[0].length;
            finalName = match[1]?.trim() || displayName;
            if (after.startsWith('))')) {
              replaceEnd = selEnd + 2;
            }
          }
        }

        const fullInsert = `((${finalName}))[${url}]`;
        target.setRangeText(fullInsert, replaceStart, replaceEnd, 'end');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    emit('add-participant', { type: payload.type, id: payload.id, name: payload.name });
    document.dispatchEvent(new CustomEvent('ww:add-participant', { detail: { type: payload.type, id: payload.id, name: payload.name } }));
  };

  const sceneFrames = useEditorSceneFrames({
    editor: tiptap.editor,
    existingPromises: computed(() => props.existingPromises),
    chapterId: computed(() => props.chapterId),
    editorMode: tiptap.editorMode
  });

  const scrollToParagraph = (paragraphIndex: number, quote?: string, blockId?: string) => {
    sceneFrames.locateScene(paragraphIndex, quote, blockId);
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
