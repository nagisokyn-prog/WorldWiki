import { ref } from 'vue';
import { settingsService } from '@worldwiki/components';

export function useTiptapState(props: any, emit: any, editor: any, editorUpdateKey: any, documentStructure: any) {
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
      } catch {
        // ignore
      }
    }
    return (localStorage.getItem('default-editor-mode') as 'wysiwyg' | 'markdown' | 'split') || 'wysiwyg';
  };

  const editorMode = ref<'wysiwyg' | 'markdown' | 'split'>(loadInitialMode());
  const settings = ref<any>(settingsService.getSettings());
  const ctrlPressed = ref(false);

  const wordCount = ref(0);
  const charCount = ref(0);

  const updateStats = () => {
    if (!editor.value) return;
    const content = editor.value.getText();
    charCount.value = content.length;
    const words = content.trim().split(/\s+/).filter((w: string) => w.length > 0);
    wordCount.value = words.length;
  };

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

  const switchEditorMode = (newMode: 'wysiwyg' | 'markdown' | 'split', syncMarkdownFromEditor: () => void) => {
    if (editorMode.value === 'markdown' || editorMode.value === 'split') {
      syncMarkdownFromEditor();
    }
    editorMode.value = newMode;
    localStorage.setItem('default-editor-mode', newMode);
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
      words: text.trim().split(/\s+/).filter((w: string) => w.length > 0).length,
      paragraphs: text.split(/\n\n+/).filter((p: string) => p.trim()).length,
      blocks: documentStructure.value.length
    });
  };

  const handleBeforeUnload = (_e: BeforeUnloadEvent) => {
    savePositionState();
    if (props.hasUnsavedChanges) {
      emit('save');
    }
  };

  return {
    modeOptions,
    editorMode,
    settings,
    ctrlPressed,
    wordCount,
    charCount,
    updateStats,
    savePositionState,
    restorePositionState,
    switchEditorMode,
    toggleLinkLock,
    analyzeText,
    handleBeforeUnload
  };
}
