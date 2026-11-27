import { describe, it, expect, afterEach } from 'vitest';
import { ref, shallowRef } from 'vue';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NarrativeFramesExtension, narrativeFramesPluginKey } from '../../extensions/NarrativeFramesExtension';
import { BlockUniqueID } from '../useTiptapExtensionList';
import { findNarrativeBlocksInDoc } from '../narrativeDocResolver';
import { useEditorSceneFrames } from '../useEditorSceneFrames';

describe('narrativeDocResolver + UniqueID + NarrativeFramesExtension', () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  function createTestEditor(html: string) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    editor = new Editor({
      element: el,
      extensions: [
        StarterKit,
        BlockUniqueID.configure({
          attributeName: 'block_id',
          types: ['paragraph', 'heading', 'blockquote'],
          generateID: (() => {
            let n = 0;
            return () => `blk_test_${++n}`;
          })()
        }),
        NarrativeFramesExtension
      ],
      content: html
    });
    return editor;
  }

  it('assigns unique block_id to paragraphs and never duplicates on Enter split', async () => {
    const ed = createTestEditor('<p>Первый абзац текста</p><p>Второй абзац текста</p>');
    await new Promise((r) => setTimeout(r, 15));
    const idsBefore: string[] = [];
    ed.state.doc.forEach((node) => {
      idsBefore.push(node.attrs.block_id);
    });
    expect(idsBefore).toHaveLength(2);
    expect(new Set(idsBefore).size).toBe(2);

    // Разбиваем первый абзац посередине через splitBlock (Enter)
    ed.commands.setTextSelection(8);
    ed.commands.splitBlock();

    const idsAfter: string[] = [];
    ed.state.doc.forEach((node) => {
      idsAfter.push(node.attrs.block_id);
    });
    expect(idsAfter).toHaveLength(3);
    expect(new Set(idsAfter).size).toBe(3);
  });

  it('prefers quote over shifted synthetic para-N so frame and locateScene never land on the wrong paragraph', () => {
    const ed = createTestEditor([
      '<p>Новый абзац, добавленный выше.</p>',
      '<p>— Значит, пока вы жили в отеле, — я усмехнулся криво, — я с автоматом бегал.</p>',
      '<p>Кира посмотрела прямо в глаза:</p>'
    ].join(''));

    // В БД лежит устаревший para-3 (после вставки абзаца выше текст уехал на 2-й абзац, а 3-й — это "Кира посмотрела...")
    const matched = findNarrativeBlocksInDoc(
      ed.state.doc,
      '— Значит, пока вы жили в отеле, — я усмехнулся криво, — я с автоматом бегал.',
      'para-3',
      3,
      ['para-3']
    );

    expect(matched).toHaveLength(1);
    expect(matched[0].node.textContent).toContain('Значит, пока вы жили в отеле');
  });

  it('re-binds by quote when real block_id points to a different paragraph text', () => {
    const ed = createTestEditor([
      '<p data-block-id="blk_wrong">Совершенно другой текст абзаца.</p>',
      '<p data-block-id="blk_right">Искомая фраза из сцены.</p>'
    ].join(''));

    const matched = findNarrativeBlocksInDoc(
      ed.state.doc,
      'Искомая фраза из сцены.',
      'blk_wrong',
      1,
      ['blk_wrong']
    );

    expect(matched).toHaveLength(1);
    expect(matched[0].node.textContent).toBe('Искомая фраза из сцены.');
  });

  it('renders narrative frames via ProseMirror Decoration.node in NarrativeFramesExtension', () => {
    const ed = createTestEditor([
      '<p>Вступление.</p>',
      '<p>— Значит, пока вы жили в отеле, — я усмехнулся криво.</p>',
      '<p>Кира посмотрела прямо в глаза:</p>'
    ].join(''));

    const existingPromises = ref<any[]>([
      {
        id: 'plot_promises:gun_1',
        kind: 'gun',
        chapter_id: 'chapters:ch_5',
        title: 'Автомат в песках',
        block_ids: ['para-3'], // сбитый индекс, должен привязаться по quote ко 2-му абзацу!
        milestones: [
          {
            chapter_id: 'chapters:ch_5',
            order_index: 3,
            block_id: 'para-3',
            block_ids: ['para-3'],
            quote: '— Значит, пока вы жили в отеле, — я усмехнулся криво.',
            stage: 'setup'
          }
        ]
      }
    ]);

    const { renderSceneFrames } = useEditorSceneFrames({
      editor: shallowRef(ed),
      existingPromises,
      chapterId: ref('chapters:ch_5'),
      editorMode: ref('wysiwyg')
    });

    renderSceneFrames();

    const decoSet = narrativeFramesPluginKey.getState(ed.state);
    expect(decoSet).toBeDefined();
    const decos = decoSet!.find();
    expect(decos).toHaveLength(1);

    const targetNode = ed.state.doc.nodeAt(decos[0].from);
    expect(targetNode?.textContent).toContain('Значит, пока вы жили в отеле');
  });

  it('expands multi-paragraph quote with short/empty lines even when only first block_id is stored', () => {
    const ed = createTestEditor([
      '<p data-block-id="blk_top"># Глава 5</p>',
      '<p data-block-id="blk_f2a0b97f"># Глава 3</p>',
      '<p data-block-id="blk_2">а ы</p>',
      '<p data-block-id="blk_3"></p>',
      '<p data-block-id="blk_4">а</p>',
      '<p data-block-id="blk_5">авы</p>',
      '<p data-block-id="blk_6">а</p>',
      '<p data-block-id="blk_7">дальше</p>',
      '<p data-block-id="blk_dup"># Глава 3</p>',
      '<p data-block-id="blk_dup2">а ы</p>'
    ].join(''));

    const matched = findNarrativeBlocksInDoc(
      ed.state.doc,
      '# Глава 3\nа ы\n\nа\nавы\nа',
      'blk_f2a0b97f',
      2,
      ['blk_f2a0b97f']
    );

    expect(matched).toHaveLength(6);
    expect(matched[0].node.attrs.block_id).toBe('blk_f2a0b97f');
    expect(matched[5].node.attrs.block_id).toBe('blk_6');
  });

  it('renders separate frames for plant and progression milestones of the same gun', () => {
    const ed = createTestEditor([
      '<p data-block-id="blk_p1">Посажено строка 1.</p>',
      '<p data-block-id="blk_p2">Посажено строка 2.</p>',
      '<p data-block-id="blk_mid">Обычный текст между вехами.</p>',
      '<p data-block-id="blk_r1">Развитие строка 1.</p>',
      '<p data-block-id="blk_r2">Развитие строка 2.</p>'
    ].join(''));

    const existingPromises = ref<any[]>([
      {
        id: 'plot_promises:gun_2',
        kind: 'gun',
        chapter_id: 'chapters:ch_5',
        title: 'Ружьё',
        block_ids: ['blk_p1', 'blk_p2'],
        milestones: [
          {
            chapter_id: 'chapters:ch_5',
            order_index: 1,
            block_id: 'blk_p1',
            block_ids: ['blk_p1', 'blk_p2'],
            quote: 'Посажено строка 1.\nПосажено строка 2.',
            stage: 'plant'
          },
          {
            chapter_id: 'chapters:ch_5',
            order_index: 4,
            block_id: 'blk_r1',
            block_ids: ['blk_r1', 'blk_r2'],
            quote: 'Развитие строка 1.\nРазвитие строка 2.',
            stage: 'progression'
          }
        ]
      }
    ]);

    const { renderSceneFrames } = useEditorSceneFrames({
      editor: shallowRef(ed),
      existingPromises,
      chapterId: ref('chapters:ch_5'),
      editorMode: ref('wysiwyg')
    });

    renderSceneFrames();

    const decoSet = narrativeFramesPluginKey.getState(ed.state);
    const decos = decoSet!.find();
    expect(decos).toHaveLength(4);
    expect((decos[0] as any).type?.attrs?.['data-narrative-frame']).toBe('first');
    expect((decos[1] as any).type?.attrs?.['data-narrative-frame']).toBe('last');
    expect((decos[2] as any).type?.attrs?.['data-narrative-frame']).toBe('first');
    expect((decos[3] as any).type?.attrs?.['data-narrative-frame']).toBe('last');
  });
});
