import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTiptapState } from '../useTiptapState';
import { settingsService } from '@worldwiki/components';

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ editor: { requireCtrlForLinks: false } }),
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
    emit = vi.fn();
    props = { project: 'proj_1', title: 'Chapter 1', hasUnsavedChanges: true };
    editorUpdateKey = ref(0);
    documentStructure = ref([{ type: 'H1', text: 'Title' }]);
    editor = ref({
      getText: () => 'Hello world of words',
      commands: { setTextSelection: vi.fn() },
      state: { selection: { anchor: 5 } },
    });
  });

  it('updates word and char count and analyzes text', () => {
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);

    state.updateStats();
    expect(state.wordCount.value).toBe(4);
    expect(state.charCount.value).toBe(20);

    state.analyzeText();
    expect(state.modeOptions.length).toBe(3);
  });

  it('saves and restores position state and switches editor modes', () => {
    const state = useTiptapState(props, emit, editor, editorUpdateKey, documentStructure);
    const syncMarkdown = vi.fn();

    state.switchEditorMode('markdown', syncMarkdown);
    expect(state.editorMode.value).toBe('markdown');

    state.savePositionState();
    state.restorePositionState();

    state.toggleLinkLock();
    expect(settingsService.saveSettings).toHaveBeenCalled();

    state.handleBeforeUnload({} as any);
    expect(emit).toHaveBeenCalledWith('save');
  });
});
