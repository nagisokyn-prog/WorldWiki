import { ref, watch, onUnmounted } from 'vue';
import { useEditor } from '@tiptap/vue-3';
import { useTiptapState } from './hooks/useTiptapState';
import { useTiptapMarkdown } from './hooks/useTiptapMarkdown';
import { useTiptapSplitView } from './hooks/useTiptapSplitView';
import { useTiptapFormatting } from './hooks/useTiptapFormatting';
import { createTiptapExtensions } from './hooks/useTiptapExtensionList';
import { useTiptapKeyboard } from './hooks/useTiptapKeyboard';
import { useTiptapLinks } from './hooks/useTiptapLinks';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/PromisesPanel/usePromisesPanel';

export interface TiptapEditorProps {
  content?: string;
  footnotesData?: Record<string, { id: string; text: string }>;
  hasUnsavedChanges?: boolean;
  project: string;
  title?: string;
  initialScrollPos?: number;
  isLocked?: boolean;
  changedFields?: string[];
  existingPromises?: (PlotPromise | RichPlotPromise)[];
}

export function useTiptapEditor(
  props: TiptapEditorProps,
  emit: (event: string, ...args: unknown[]) => void
) {
  const editorUpdateKey = ref(0);

  const editor = useEditor({
    extensions: createTiptapExtensions(props.project),
    content: props.content || '',
    onCreate: () => {
      stateHook.updateStats();
      mdHook.syncMarkdownFromEditor();
    },
    onUpdate: () => {
      if (stateHook.editorMode.value === 'word') return;
      if (editor.value) {
        emit('update:content', editor.value.getHTML());
        emit('change');
        stateHook.updateStats();
        mdHook.syncMarkdownFromEditor();
        // Резервный сигнал для PromisesPanel — после того как Vue обновит props через v-model
        setTimeout(() => { document.dispatchEvent(new CustomEvent('ww:editor-content-updated')); }, 0);
      }
    }
  });

  const splitHook = useTiptapSplitView(editor, editorUpdateKey);
  const stateHook = useTiptapState(props, emit, editor, editorUpdateKey, splitHook.documentStructure);
  const mdHook = useTiptapMarkdown(editor, emit, stateHook.updateStats);
  const formatHook = useTiptapFormatting(editor, emit, editorUpdateKey);

  useTiptapKeyboard({
    ctrlPressed: stateHook.ctrlPressed,
    settings: stateHook.settings,
    hasUnsavedChanges: () => Boolean(props.hasUnsavedChanges),
    onSave: () => emit('save'),
    onRestorePosition: () => stateHook.restorePositionState(),
    onSavePosition: () => stateHook.savePositionState(),
    onBeforeUnload: stateHook.handleBeforeUnload,
    onToggleStructure: () => {
      splitHook.showStructure.value = !splitHook.showStructure.value;
    }
  });

  useTiptapLinks({
    project: props.project,
    isLocked: props.isLocked,
    ctrlPressed: stateHook.ctrlPressed,
    editor,
    onOpenEntity: (payload) => emit('openEntity', payload)
  });

  const updateTitle = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    emit('update:title', val);
    emit('change');
  };

  const handleScroll = (e: Event) => {
    emit('scroll-change', (e.target as HTMLElement).scrollTop);
  };

  watch(
    () => editor.value,
    (ed) => {
      if (ed) {
        stateHook.updateStats();
        mdHook.syncMarkdownFromEditor();
      }
    },
    { immediate: true }
  );

  watch(
    () => stateHook.editorMode.value,
    (mode) => {
      if (mode === 'split' || mode === 'markdown') {
        mdHook.syncMarkdownFromEditor();
      }
    }
  );

  watch(
    () => props.content,
    (newContent) => {
      if (stateHook.editorMode.value === 'word') return;
      if (editor.value && editor.value.getHTML() !== newContent) {
        editor.value.commands.setContent(newContent || '');
        stateHook.updateStats();
        mdHook.syncMarkdownFromEditor();
      }
    }
  );

  watch(
    () => props.footnotesData,
    (newFootnotes) => {
      formatHook.footnotes.value = { ...(newFootnotes || {}) };
    }
  );

  onUnmounted(() => {
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
    switchEditorMode: (newMode: 'wysiwyg' | 'markdown' | 'split' | 'word') => {
      const prevMode = stateHook.editorMode.value;
      stateHook.switchEditorMode(newMode, mdHook.syncMarkdownFromEditor);
      if (prevMode === 'word' && newMode !== 'word' && editor.value && props.content) {
        editor.value.commands.setContent(props.content);
        stateHook.updateStats();
        mdHook.syncMarkdownFromEditor();
      }
    }
  };
}