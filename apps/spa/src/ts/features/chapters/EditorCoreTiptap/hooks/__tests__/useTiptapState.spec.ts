import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useTiptapState } from '../useTiptapState';
import { settingsService } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: vi.fn(() => ({ editor: { requireCtrlForLinks: false } })),
    saveSettings: vi.fn(),
  },
}));

describe('useTiptapState', () => {
  let props: any;
  let emit: any;
  let editor: any;
  let editorUpdateKey: any;
  let documentStructure: any;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
    emit = vi.fn();
    props = { project: 'proj_1', title: 'Chapter 1', hasUnsavedChanges: true, initialScrollPos: 200 };
    editorUpdateKey = ref(0);
    documentStructure = ref([{ type: 'H1', text: 'Title' }]);
    editor = ref({
      getText: () => 'Hello world of words\n\nParagraph 2',
      commands: { setTextSelection: vi.fn() },
      state: { selection: { anchor: 5 } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads initial mode from various localStorage states (valid JSON, invalid, fallback)', () => {
    const key = `editor-state-${props.project}-${props.title}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Valid saved split mode
    localStorage.setItem(key, JSON.stringify({ mode: 'split' }));
    let state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);
    expect(state.editorMode.value).toBe('split');

    // Invalid JSON
    localStorage.setItem(key, '{ invalid json');
    localStorage.setItem('default-editor-mode', 'markdown');
    state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);
    expect(state.editorMode.value).toBe('markdown');

    // Nothing in storage
    localStorage.clear();
    state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);
    expect(state.editorMode.value).toBe('wysiwyg');
  });

  it('updates stats and analyzes text with empty and populated editor', () => {
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);

    state.updateStats();
    expect(state.wordCount.value).toBe(6);
    expect(state.charCount.value).toBe(33);

    state.analyzeText();

    // With null editor
    editor.value = null;
    state.updateStats();
    state.analyzeText();
  });

  it('handles savePositionState across wysiwyg, split, and markdown modes with and without DOM elements', () => {
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);

    // Save with no DOM elements in document
    state.editorMode.value = 'wysiwyg';
    state.savePositionState();
    state.editorMode.value = 'split';
    state.savePositionState();
    state.editorMode.value = 'markdown';
    state.savePositionState();

    // WYSIWYG
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'editor-wrapper';
    wrapperEl.scrollTop = 120;
    document.body.appendChild(wrapperEl);

    state.editorMode.value = 'wysiwyg';
    state.savePositionState();

    // Split
    const splitParent = document.createElement('div');
    splitParent.scrollTop = 240;
    const splitChild = document.createElement('div');
    splitChild.className = 'editor-content-split';
    splitParent.appendChild(splitChild);
    document.body.appendChild(splitParent);

    state.editorMode.value = 'split';
    state.savePositionState();

    // Markdown
    const textarea = document.createElement('textarea');
    textarea.selectionStart = 15;
    textarea.scrollTop = 80;
    document.body.appendChild(textarea);

    state.editorMode.value = 'markdown';
    state.savePositionState();

    document.body.removeChild(wrapperEl);
    document.body.removeChild(splitParent);
    document.body.removeChild(textarea);
  });

  it('handles restorePositionState for markdown, split, wysiwyg, and initial scroll fallback', () => {
    const key = `editor-state-${props.project}-${props.title}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);

    // Markdown restore without textarea in DOM
    localStorage.setItem(key, JSON.stringify({ cursor: 10, scroll: 50 }));
    state.editorMode.value = 'markdown';
    state.restorePositionState();
    vi.advanceTimersByTime(200);

    // Markdown restore with textarea
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    state.restorePositionState();
    vi.advanceTimersByTime(200);
    expect(textarea.scrollTop).toBe(50);
    document.body.removeChild(textarea);

    // WYSIWYG restore
    state.editorMode.value = 'wysiwyg';
    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'editor-wrapper';
    document.body.appendChild(wrapperEl);
    state.restorePositionState();
    vi.advanceTimersByTime(200);
    expect(wrapperEl.scrollTop).toBe(50);

    // Split restore
    state.editorMode.value = 'split';
    const splitParent = document.createElement('div');
    const splitChild = document.createElement('div');
    splitChild.className = 'editor-content-split';
    splitParent.appendChild(splitChild);
    document.body.appendChild(splitParent);
    state.restorePositionState();
    vi.advanceTimersByTime(200);
    expect(splitParent.scrollTop).toBe(50);

    // Fallback with initialScrollPos and no saved state
    localStorage.removeItem(key);
    state.restorePositionState();
    vi.advanceTimersByTime(200);
    expect(wrapperEl.scrollTop).toBe(200);

    // Fallback when DOM element is missing
    document.body.removeChild(wrapperEl);
    document.body.removeChild(splitParent);
    state.restorePositionState();
    vi.advanceTimersByTime(200);
  });

  it('switches modes and calls syncMarkdown only when coming from markdown/split', () => {
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);
    const syncMarkdown = vi.fn();

    // From WYSIWYG to markdown
    state.editorMode.value = 'wysiwyg';
    state.switchEditorMode('markdown', syncMarkdown);
    expect(syncMarkdown).not.toHaveBeenCalled();

    // From markdown to split
    state.switchEditorMode('split', syncMarkdown);
    expect(syncMarkdown).toHaveBeenCalledTimes(1);
  });

  it('toggles link lock setting and initializes editor object if missing', () => {
    (settingsService.getSettings as any).mockReturnValueOnce({});
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);

    state.toggleLinkLock();
    expect(settingsService.saveSettings).toHaveBeenCalledWith({
      editor: { requireCtrlForLinks: true },
    });
  });

  it('handles beforeunload with and without unsaved changes', () => {
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);

    props.hasUnsavedChanges = false;
    state.handleBeforeUnload({} as any);
    expect(emit).not.toHaveBeenCalled();

    props.hasUnsavedChanges = true;
    state.handleBeforeUnload({} as any);
    expect(emit).toHaveBeenCalledWith('save');
  });
});
