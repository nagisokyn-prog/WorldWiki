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
});
