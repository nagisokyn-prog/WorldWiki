import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useEditorSceneFrames, findSceneElements } from '../useEditorSceneFrames';
import type { PlotPromise } from '@/types/generated/PlotPromise';

describe('useEditorSceneFrames', () => {
  let editorDom: HTMLDivElement;

  beforeEach(() => {
    editorDom = document.createElement('div');
    document.body.appendChild(editorDom);
  });

  it('finds scene elements by blockId and quote', () => {
    const p1 = document.createElement('p');
    p1.setAttribute('data-block-id', 'b-100');
    p1.textContent = 'Прежде чем отец что-то сказал, я открыл свой военный билет.';
    editorDom.appendChild(p1);

    const foundById = findSceneElements(editorDom, undefined, 'b-100');
    expect(foundById).toHaveLength(1);
    expect(foundById[0]).toBe(p1);

    const foundByQuote = findSceneElements(editorDom, 'Прежде чем отец что-то сказал');
    expect(foundByQuote).toHaveLength(1);
    expect(foundByQuote[0]).toBe(p1);

    const foundByPrefixedBlockId = findSceneElements(editorDom, undefined, undefined, undefined, ['blk_ch1_b-100']);
    expect(foundByPrefixedBlockId).toHaveLength(1);
    expect(foundByPrefixedBlockId[0]).toBe(p1);
  });

  it('renders contiguous merged frames (first, middle, last) for multi-paragraph nodes', () => {
    const p1 = document.createElement('p');
    p1.textContent = 'Параграф первый начала сцены.';
    const p2 = document.createElement('p');
    p2.textContent = 'Параграф второй середины сцены.';
    const p3 = document.createElement('p');
    p3.textContent = 'Параграф третий финала сцены.';
    editorDom.appendChild(p1);
    editorDom.appendChild(p2);
    editorDom.appendChild(p3);

    const mockEditor = {
      view: { dom: editorDom }
    };

    const existingPromises = ref<PlotPromise[]>([
      {
        id: 'plot_promises:scene_1',
        project_id: 'proj_1',
        kind: 'scene',
        title: 'Тестовая сцена',
        status: 'planted',
        milestones: [
          { milestone_id: 'm1', stage: 'setup', quote: 'Параграф первый начала сцены', block_id: null, chapter_id: 'ch_1', order_index: 1 },
          { milestone_id: 'm2', stage: 'progression', quote: 'Параграф второй середины сцены', block_id: null, chapter_id: 'ch_1', order_index: 2 },
          { milestone_id: 'm3', stage: 'resolution', quote: 'Параграф третий финала сцены', block_id: null, chapter_id: 'ch_1', order_index: 3 },
        ],
        location_id: null,
        timeline_event_id: null,
        m_abs: null,
        calendar_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
    ]);

    const { renderSceneFrames } = useEditorSceneFrames({
      editor: ref(mockEditor as any),
      existingPromises,
      chapterId: ref('ch_1'),
      editorMode: ref('wysiwyg')
    });

    renderSceneFrames();

    expect(p1.classList.contains('narrative-frame-first')).toBe(true);
    expect(p1.classList.contains('narrative-kind-scene')).toBe(true);

    expect(p2.classList.contains('narrative-frame-middle')).toBe(true);
    expect(p2.classList.contains('narrative-kind-scene')).toBe(true);

    expect(p3.classList.contains('narrative-frame-last')).toBe(true);
    expect(p3.classList.contains('narrative-kind-scene')).toBe(true);
  });

  it('renders frames for conflict, gun, and other narrative kinds', () => {
    const pConflict = document.createElement('p');
    pConflict.textContent = 'Жестокое столкновение на границе секторов.';
    editorDom.appendChild(pConflict);

    const mockEditor = {
      view: { dom: editorDom }
    };

    const existingPromises = ref<PlotPromise[]>([
      {
        id: 'plot_promises:conflict_1',
        project_id: 'proj_1',
        kind: 'conflict',
        title: 'Столкновение',
        status: 'planted',
        milestones: [
          { milestone_id: 'm1', stage: 'setup', quote: 'Жестокое столкновение', block_id: null, chapter_id: 'ch_1', order_index: 1 }
        ],
        location_id: null,
        timeline_event_id: null,
        m_abs: null,
        calendar_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
    ]);

    const { renderSceneFrames } = useEditorSceneFrames({
      editor: ref(mockEditor as any),
      existingPromises,
      chapterId: ref('ch_1'),
      editorMode: ref('wysiwyg')
    });

    renderSceneFrames();

    expect(pConflict.classList.contains('narrative-frame-single')).toBe(true);
    expect(pConflict.classList.contains('narrative-kind-conflict')).toBe(true);
    expect(pConflict.getAttribute('data-narrative-kind')).toBe('conflict');
  });

  it('re-renders frames automatically on editor update events (e.g. backspace / typing)', async () => {
    const p1 = document.createElement('p');
    p1.textContent = 'Новая сцена диалога.';
    editorDom.appendChild(p1);

    let updateCallback: (() => void) | null = null;
    const mockEditor = {
      view: { dom: editorDom },
      on: (event: string, cb: () => void) => {
        if (event === 'update') updateCallback = cb;
      },
      off: (event: string) => {
        if (event === 'update') updateCallback = null;
      }
    };

    const existingPromises = ref<PlotPromise[]>([
      {
        id: 'plot_promises:scene_dyn',
        project_id: 'proj_1',
        kind: 'scene',
        title: 'Новая сцена диалога',
        status: 'planted',
        milestones: [
          { milestone_id: 'm1', stage: 'setup', quote: 'Новая сцена диалога', block_id: null, chapter_id: 'ch_1', order_index: 1 }
        ],
        location_id: null,
        timeline_event_id: null,
        m_abs: null,
        calendar_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
    ]);

    useEditorSceneFrames({
      editor: ref(mockEditor as any),
      existingPromises,
      chapterId: ref('ch_1'),
      editorMode: ref('wysiwyg')
    });

    expect(typeof updateCallback).toBe('function');
    if (updateCallback) {
      (updateCallback as () => void)();
    }
  });

  it('does NOT render promises belonging to other chapters into the current chapter', () => {
    const p1 = document.createElement('p');
    p1.textContent = 'Текст главы 1, первый абзац.';
    editorDom.appendChild(p1);

    const mockEditor = {
      view: { dom: editorDom }
    };

    const existingPromises = ref<PlotPromise[]>([
      {
        id: 'plot_promises:scene_chap_2',
        project_id: 'proj_1',
        kind: 'scene',
        title: 'Сцена из Главы 2',
        status: 'planted',
        milestones: [
          { milestone_id: 'm_ch2', stage: 'setup', quote: 'Сцена из Главы 2', block_id: null, chapter_id: 'ch_2', order_index: 1 }
        ],
        location_id: null,
        timeline_event_id: null,
        m_abs: null,
        calendar_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
    ]);

    const { renderSceneFrames } = useEditorSceneFrames({
      editor: ref(mockEditor as any),
      existingPromises,
      chapterId: ref('ch_1'),
      editorMode: ref('wysiwyg')
    });

    renderSceneFrames();

    // В Главе 1 не должно отрендериться фреймов от обещания из Главы 2!
    expect(p1.classList.contains('scene-frame')).toBe(false);
    expect(p1.classList.contains('narrative-frame-first')).toBe(false);
    expect(p1.classList.contains('narrative-frame-single')).toBe(false);
  });

  it('single paragraph selection does NOT leak to whole chapter when empty or short paragraphs exist', () => {
    const p1 = document.createElement('p');
    p1.textContent = 'Первый абзац с важным действием.';
    const p2 = document.createElement('p');
    p2.textContent = ''; // Пустой абзац
    const p3 = document.createElement('p');
    p3.textContent = '— Да.'; // Короткая реплика
    editorDom.appendChild(p1);
    editorDom.appendChild(p2);
    editorDom.appendChild(p3);

    const found = findSceneElements(editorDom, 'Первый абзац с важным действием.');
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(p1);
  });

  it('renders embedded highlight and icon for gun when it is inside an existing scene without breaking scene continuity', () => {
    const p1 = document.createElement('p');
    p1.textContent = 'Начало большой сцены диалога.';
    const p2 = document.createElement('p');
    p2.textContent = 'Здесь лежит старый револьвер отца.';
    const p3 = document.createElement('p');
    p3.textContent = 'Конец большой сцены диалога.';
    editorDom.appendChild(p1);
    editorDom.appendChild(p2);
    editorDom.appendChild(p3);

    const mockEditor = {
      view: { dom: editorDom }
    };

    const existingPromises = ref<PlotPromise[]>([
      {
        id: 'plot_promises:scene_macro',
        project_id: 'proj_1',
        kind: 'scene',
        title: 'Большая сцена',
        status: 'planted',
        milestones: [
          { milestone_id: 'm1', stage: 'setup', quote: 'Начало большой сцены диалога', block_id: null, chapter_id: 'ch_1', order_index: 1 },
          { milestone_id: 'm2', stage: 'progression', quote: 'Здесь лежит старый револьвер отца', block_id: null, chapter_id: 'ch_1', order_index: 2 },
          { milestone_id: 'm3', stage: 'resolution', quote: 'Конец большой сцены диалога', block_id: null, chapter_id: 'ch_1', order_index: 3 },
        ],
        location_id: null,
        timeline_event_id: null,
        m_abs: null,
        calendar_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'plot_promises:gun_micro',
        project_id: 'proj_1',
        kind: 'gun',
        title: 'Револьвер',
        status: 'planted',
        milestones: [
          { milestone_id: 'm_gun', stage: 'setup', quote: 'Здесь лежит старый револьвер отца', block_id: null, chapter_id: 'ch_1', order_index: 2 }
        ],
        location_id: null,
        timeline_event_id: null,
        m_abs: null,
        calendar_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }
    ]);

    const { renderSceneFrames } = useEditorSceneFrames({
      editor: ref(mockEditor as any),
      existingPromises,
      chapterId: ref('ch_1'),
      editorMode: ref('wysiwyg')
    });

    renderSceneFrames();

    // Сцена остаётся монолитным каркасом
    expect(p1.classList.contains('narrative-frame-first')).toBe(true);
    expect(p2.classList.contains('narrative-frame-middle')).toBe(true);
    expect(p3.classList.contains('narrative-frame-last')).toBe(true);

    // Второй абзац дополнительно получает вложенный индикатор ружья
    expect(p2.classList.contains('narrative-embedded-gun')).toBe(true);
    expect(p2.getAttribute('data-embedded-kind')).toBe('gun');
  });

  it('matches elements strictly by block_ids with para-N fallback indices', () => {
    const p1 = document.createElement('p');
    p1.textContent = 'Абзац 1';
    const p2 = document.createElement('p');
    p2.textContent = 'Абзац 2';
    editorDom.appendChild(p1);
    editorDom.appendChild(p2);

    const found = findSceneElements(editorDom, undefined, undefined, undefined, ['para-2']);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(p2);
  });

  it('expands multi-paragraph scene when a paragraph in the middle is split with Enter and an empty line', () => {
    const paragraphs = [
      'Прежде чем отец что-то сказал, я открыл военный билет.',
      '— Ну и ветрище сегодня, — пробормотал Лёша.',
      '— И не говори. Только давай не тут.',
      '— Пошли в вагончик, хоть ветра не будет.',
      '— Угу. Только если мы тут заболеем, т',
      '',
      'о пеняй на себя.',
      '— Началось...',
      '— Да не бузи ты так.',
      'После этого мы молча пошли дальше.'
    ].map((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      editorDom.appendChild(p);
      return p;
    });

    const originalQuote = [
      '— И не говори. Только давай не тут.',
      '— Пошли в вагончик, хоть ветра не будет.',
      '— Угу. Только если мы тут заболеем, то пеняй на себя.',
      '— Началось...',
      '— Да не бузи ты так.'
    ].join('\n');

    // Изначально сцена занимала para-3..para-7, но после двух Enter в середине растянулась на para-3..para-9
    const found = findSceneElements(
      editorDom,
      originalQuote,
      'para-3',
      3,
      ['para-3', 'para-4', 'para-5', 'para-6', 'para-7']
    );

    expect(found).toHaveLength(7);
    expect(found[0]).toBe(paragraphs[2]); // para-3
    expect(found[3]).toBe(paragraphs[5]); // пустой абзац para-6 внутри сцены
    expect(found[6]).toBe(paragraphs[8]); // para-9 ("— Да не бузи ты так.")
  });
});
