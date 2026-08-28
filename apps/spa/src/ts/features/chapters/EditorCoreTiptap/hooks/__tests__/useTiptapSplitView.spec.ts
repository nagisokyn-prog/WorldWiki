import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTiptapSplitView } from '../useTiptapSplitView';

describe('useTiptapSplitView', () => {
  let editor: any;
  let editorUpdateKey: any;

  beforeEach(() => {
    localStorage.clear();
    editorUpdateKey = ref(0);
    editor = ref({
      getJSON: () => ({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Chapter Subtitle' }] },
          { type: 'paragraph', attrs: { semanticTag: 'desc' }, content: [{ type: 'text', text: 'Paragraph body' }] },
          { type: 'bulletList', content: [{ type: 'listItem' }, { type: 'listItem' }] },
          { type: 'orderedList', content: [{ type: 'listItem' }] },
          { type: 'blockquote', content: [{ type: 'text', text: 'A wise quote' }] },
          { type: 'codeBlock', content: [{ type: 'text', text: 'const x = 1;' }] },
          { type: 'table', content: [{ type: 'tableRow' }, { type: 'tableRow' }] },
        ],
      }),
    });
  });

  it('traverses all document structure types and handles block scrolling', () => {
    const split = useTiptapSplitView(editor, editorUpdateKey);

    const blocks = split.documentStructure.value;
    expect(blocks.length).toBe(7);
    expect(blocks[0].type).toBe('H2');
    expect(blocks[1].type).toBe('Paragraph');
    expect(blocks[2].type).toBe('List');
    expect(blocks[3].type).toBe('Ordered');
    expect(blocks[4].type).toBe('Quote');
    expect(blocks[5].type).toBe('Code');
    expect(blocks[6].type).toBe('Table');

    split.scrollToBlock(3);
    expect(split.selectedBlockIdx.value).toBe(3);
  });

  it('handles left and right panel resizing', () => {
    const split = useTiptapSplitView(editor, editorUpdateKey);

    const parent = document.createElement('div');
    Object.defineProperty(parent, 'offsetWidth', { value: 1000 });
    const handle = document.createElement('div');
    parent.appendChild(handle);
    document.body.appendChild(parent);

    const event = {
      preventDefault: () => {},
      currentTarget: handle,
      clientX: 200,
    } as any;

    // Resize Left
    split.startResizeLeft(event);
    expect(split.resizing.value).toBe('left');

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250 }));
    expect(split.leftPanelWidth.value).toBe(45);

    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(split.resizing.value).toBeNull();
    expect(localStorage.getItem('split-view-left-width')).toBe('45');

    // Resize Right
    split.startResizeRight(event);
    expect(split.resizing.value).toBe('middle');

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }));
    expect(split.rightPanelWidth.value).toBe(45);

    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(split.resizing.value).toBeNull();
    expect(localStorage.getItem('split-view-right-width')).toBe('45');

    document.body.removeChild(parent);
  });

  describe('Branch edge cases for useTiptapSplitView', () => {
    it('initializes widths and structure visibility from localStorage', () => {
      localStorage.setItem('split-view-show-structure', 'false');
      localStorage.setItem('split-view-left-width', '55');
      localStorage.setItem('split-view-right-width', '25');

      const split = useTiptapSplitView(editor, editorUpdateKey);
      expect(split.showStructure.value).toBe(false);
      expect(split.leftPanelWidth.value).toBe(55);
      expect(split.rightPanelWidth.value).toBe(25);
    });

    it('handles null editor and empty document gracefully in documentStructure', () => {
      const nullEditor = ref(null);
      const splitNull = useTiptapSplitView(nullEditor, editorUpdateKey);
      expect(splitNull.documentStructure.value).toEqual([]);

      const emptyDocEditor = ref({
        getJSON: () => ({ type: 'doc' }), // no content
      });
      const splitEmpty = useTiptapSplitView(emptyDocEditor, editorUpdateKey);
      expect(splitEmpty.documentStructure.value).toEqual([]);

      const nullDocEditor = ref({
        getJSON: () => null,
      });
      const splitNullDoc = useTiptapSplitView(nullDocEditor as any, editorUpdateKey);
      expect(splitNullDoc.documentStructure.value).toEqual([]);
    });

    it('handles headings without level and long text in traverse', () => {
      const longText = 'A'.repeat(80);
      const complexDocEditor = ref({
        getJSON: () => ({
          type: 'doc',
          content: [
            { type: 'heading', content: [{ type: 'text', text: longText }] }, // heading without level + long text
            { type: 'paragraph', content: [{ type: 'text', text: 'Normal text' }] }, // paragraph without semanticTag
          ],
        }),
      });

      const split = useTiptapSplitView(complexDocEditor, editorUpdateKey);
      const blocks = split.documentStructure.value;
      expect(blocks.length).toBe(2);
      expect(blocks[0].type).toBe('H1');
      expect(blocks[0].text.endsWith('...')).toBe(true);
      expect(blocks[1].semanticTag).toBe('desc');

      // Array node passed to traverse (covers line 95) and null node (line 92) and empty lists (lines 115, 121)
      const arrayDocEditor = ref({
        getJSON: () => ({
          type: 'doc',
          content: [
            [
              { type: 'paragraph', content: [{ type: 'text', text: 'In array' }] },
            ] as any,
            null as any,
            undefined as any,
            { attrs: { some: 'attr' } } as any, // covers line 96 else when node.type is missing
            { type: 'orderedList' }, // no content, covers line 115
            { type: 'table' },       // no content, covers line 121
          ],
        }),
      });
      const splitArray = useTiptapSplitView(arrayDocEditor, editorUpdateKey);
      expect(splitArray.documentStructure.value.length).toBe(3);
    });

    it('clamps left and right panel widths to min (20%) and max (60%)', () => {
      const split = useTiptapSplitView(editor, editorUpdateKey);

      const parent = document.createElement('div');
      Object.defineProperty(parent, 'offsetWidth', { value: 1000 });
      const handle = document.createElement('div');
      parent.appendChild(handle);
      document.body.appendChild(parent);

      const event = {
        preventDefault: () => {},
        currentTarget: handle,
        clientX: 200,
      } as any;

      // 1. Min clamp (move far left)
      split.startResizeLeft(event);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: -9999 }));
      expect(split.leftPanelWidth.value).toBe(20);
      document.dispatchEvent(new MouseEvent('mouseup'));

      // 2. Max clamp (move far right)
      split.startResizeLeft(event);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 9999 }));
      expect(split.leftPanelWidth.value).toBe(60);
      document.dispatchEvent(new MouseEvent('mouseup'));

      // 3. Null container early return
      const orphanHandle = document.createElement('div');
      split.startResizeLeft({ preventDefault: () => {}, currentTarget: orphanHandle } as any);
      split.startResizeRight({ preventDefault: () => {}, currentTarget: orphanHandle } as any);

      document.body.removeChild(parent);
    });
  });
});

