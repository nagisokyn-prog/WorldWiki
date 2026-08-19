import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTiptapSplitView } from '../useTiptapSplitView';

describe('useTiptapSplitView', () => {
  let editor: any;
  let editorUpdateKey: any;

  beforeEach(() => {
    editorUpdateKey = ref(0);
    editor = ref({
      getJSON: () => ({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter Title' }] },
          { type: 'paragraph', attrs: { semanticTag: 'desc' }, content: [{ type: 'text', text: 'Paragraph body' }] },
        ],
      }),
    });
  });

  it('traverses document structure and handles block scrolling', () => {
    const split = useTiptapSplitView(editor, editorUpdateKey);

    expect(split.documentStructure.value.length).toBe(2);
    expect(split.documentStructure.value[0].type).toBe('H1');
    expect(split.documentStructure.value[1].type).toBe('Paragraph');

    split.scrollToBlock(1);
    expect(split.selectedBlockIdx.value).toBe(1);
  });
});
