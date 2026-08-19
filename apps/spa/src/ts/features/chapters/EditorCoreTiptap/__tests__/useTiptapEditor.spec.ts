import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTiptapEditor } from '../useTiptapEditor';

vi.mock('@tiptap/vue-3', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useEditor: vi.fn(() => ref({
      getHTML: () => '<p>Test</p>',
      getText: () => 'Test',
      commands: { setContent: vi.fn() },
      chain: () => ({ focus: () => ({ run: vi.fn() }) }),
      destroy: vi.fn(),
    })),
    VueNodeViewRenderer: vi.fn(),
  };
});

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({}),
  },
}));

describe('useTiptapEditor', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      content: '<p>Chapter text</p>',
      project: 'proj_1',
      title: 'Chapter 1',
    };
  });

  it('initializes editor composable', () => {
    const tiptap = useTiptapEditor(props, emit);

    expect(tiptap.editor).toBeDefined();
    expect(tiptap.wordCount).toBeDefined();
  });
});
