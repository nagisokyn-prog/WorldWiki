import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlanningPanel } from '../usePlanningPanel';
import * as api from '../../../../services/api.client';
import { chapterService } from '../../../../services/chapter.service';
import { setActivePinia, createPinia } from 'pinia';
import { useChapterStore } from '../../../../stores/chapter.store';
import { useStoryArcsStore } from '../../../../stores/story_arcs.store';

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
  appConfirm: vi.fn(),
}));

vi.mock('../../../../services/api.client', () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  toggleTodo: vi.fn(),
  setTodoStatus: vi.fn(),
  deleteTodo: vi.fn(),
  createChapter: vi.fn(),
  assignChapter: vi.fn(),
  getChapterHierarchy: vi.fn(),
  getStoryArcs: vi.fn(),
}));

vi.mock('../../../../services/chapter.service', () => ({
  chapterService: {
    createNew: vi.fn().mockImplementation((title) => ({
      id: 'chapters:ch_new',
      title,
      volume_id: 'volumes:vol_1',
      sort_order: 1,
      content: '',
      word_count: 0
    })),
    save: vi.fn().mockResolvedValue('chapters:ch_new')
  }
}));

describe('usePlanningPanel - Unified Tapestry', () => {
  let props: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    const chapterStore = useChapterStore();
    chapterStore.hierarchy = {
      volumes: [{ id: 'volumes:vol_1', title: 'Том 1: Пепел' }],
      chapters: [
        { id: 'chapters:ch_1', volume_id: 'volumes:vol_1', title: 'Глава 1: Пролог', sort_order: 1 as any } as any,
        { id: 'chapters:ch_2', volume_id: 'volumes:vol_1', title: 'Глава 2: Дом?', sort_order: 2 as any } as any
      ]
    };
    chapterStore.currentChapterId = 'chapters:ch_2';

    const arcsStore = useStoryArcsStore();
    arcsStore.arcs = [
      { id: 'story_arcs:arc_1', title: 'Возвращение домой', color: 'var(--accent)', arc_type: 'plot', status: 'active', project_id: 'proj_1' }
    ];
    arcsStore.arcChapters.set('story_arcs:arc_1', [
      { chapter_id: 'chapters:ch_2', phase: 'escalation' }
    ]);
    vi.mocked(api.getStoryArcs).mockResolvedValue(arcsStore.arcs as any);

    props = {
      project: 'proj_1',
      volumeId: 'volumes:vol_1',
      volumeTitle: 'Том 1: Пепел',
      currentChapterId: 'chapters:ch_2',
      currentChapterTitle: 'Глава 2: Дом?',
    };
  });

  it('loads tapestry with chapters, groups todos by arcs and standalone tasks', async () => {
    vi.mocked(api.getTodos).mockImplementation(async (ownerId) => {
      if (ownerId === 'chapters:ch_2') {
        return [
          { id: 't1', owner_id: 'chapters:ch_2', text: 'Узнать пароль', arc_id: 'story_arcs:arc_1', status: 'in_progress', is_done: false, sort_order: 1 },
          { id: 't2', owner_id: 'chapters:ch_2', text: 'Проверить описания', arc_id: null, status: 'planned', is_done: false, sort_order: 2 },
        ] as any;
      }
      if (ownerId === 'volumes:vol_1') {
        return [
          { id: 'b1', owner_id: 'volumes:vol_1', text: 'Идея для финала', arc_id: null, status: 'planned', is_done: false, sort_order: 1 }
        ] as any;
      }
      return [];
    });

    const panel = usePlanningPanel(props);
    await panel.load();

    expect(panel.chaptersList.value.length).toBe(2);
    const ch2 = panel.chaptersList.value.find(c => c.chapterId === 'chapters:ch_2');
    expect(ch2).toBeDefined();
    expect(ch2?.isCurrent).toBe(true);

    // Arc group
    expect(ch2?.arcGroups.length).toBe(1);
    expect(ch2?.arcGroups[0].title).toBe('Возвращение домой');
    expect(ch2?.arcGroups[0].todos[0].text).toBe('Узнать пароль');

    // Standalone
    expect(ch2?.standaloneTodos.length).toBe(1);
    expect(ch2?.standaloneTodos[0].text).toBe('Проверить описания');

    // Backlog
    expect(panel.backlogTodos.value.length).toBe(1);
    expect(panel.backlogTodos.value[0].text).toBe('Идея для финала');

    // Stats
    expect(panel.volumeStats.value.total).toBe(3);
    expect(panel.volumeStats.value.inProgress).toBe(1);
    expect(panel.volumeStats.value.planned).toBe(2);
  });

  it('toggles status cycle and cascade unblocks dependencies when done', async () => {
    const todo: any = {
      id: 't1',
      owner_id: 'chapters:ch_2',
      text: 'Родительская задача',
      status: 'in_progress',
      done: false
    };

    const dependentTodo: any = {
      id: 't2',
      owner_id: 'chapters:ch_2',
      text: 'Зависимая задача',
      status: 'blocked',
      done: false,
      depends_on: 't1'
    };

    const panel = usePlanningPanel(props);
    panel.chaptersList.value = [{
      chapterId: 'chapters:ch_2',
      title: 'Глава 2',
      sortOrder: 2,
      isCurrent: true,
      isCollapsed: false,
      arcGroups: [{
        arcId: 'arc_1',
        title: 'Арка',
        todos: [todo, dependentTodo]
      }],
      standaloneTodos: [],
      doneCount: 0,
      totalCount: 2
    }];

    vi.mocked(api.setTodoStatus).mockResolvedValue({} as any);

    await panel.toggleTodoStatus(todo);
    expect(todo.status).toBe('done');
    expect(todo.done).toBe(true);

    // Cascade unblock in memory
    expect(dependentTodo.status).toBe('planned');
  });

  it('outlining: creates a planned chapter node in tree and appends to stream without switching current chapter', async () => {
    const panel = usePlanningPanel(props);
    await panel.load();

    await panel.addPlannedChapter('Глава 3: Побег');

    expect(chapterService.createNew).toHaveBeenCalledWith('Глава 3: Побег');
    expect(chapterService.save).toHaveBeenCalled();
    expect(api.assignChapter).toHaveBeenCalled();

    const newChapter = panel.chaptersList.value.find(c => c.title === 'Глава 3: Побег');
    expect(newChapter).toBeDefined();
    expect(newChapter?.isCurrent).toBe(false);
  });

  it('moves volume backlog item to current chapter', async () => {
    vi.mocked(api.createTodo).mockResolvedValue('t_moved_id');
    vi.mocked(api.deleteTodo).mockResolvedValue(undefined as any);

    const panel = usePlanningPanel(props);
    panel.backlogTodos.value = [
      { id: 'b1', owner_id: 'volumes:vol_1', text: 'Сцена в таверне', status: 'planned', done: false, sort_order: 1 }
    ];
    panel.chaptersList.value = [{
      chapterId: 'chapters:ch_2',
      title: 'Глава 2',
      sortOrder: 2,
      isCurrent: true,
      isCollapsed: false,
      arcGroups: [],
      standaloneTodos: [],
      doneCount: 0,
      totalCount: 0
    }];

    await panel.moveBacklogToChapter('b1');

    expect(panel.backlogTodos.value.length).toBe(0);
    const ch2 = panel.chaptersList.value[0];
    expect(ch2.standaloneTodos.length).toBe(1);
    expect(ch2.standaloneTodos[0].text).toBe('Сцена в таверне');
    expect(ch2.standaloneTodos[0].owner_id).toBe('chapters:ch_2');
  });

  it('correctly toggles chapter collapse on first click and toggles volume collapse', async () => {
    vi.mocked(api.getTodos).mockResolvedValue([]);
    const panel = usePlanningPanel(props);
    await panel.load();

    const ch1 = panel.chaptersList.value.find(c => c.chapterId === 'chapters:ch_1');
    const ch2 = panel.chaptersList.value.find(c => c.chapterId === 'chapters:ch_2');
    expect(ch1?.isCollapsed).toBe(true); // non-current starts collapsed
    expect(ch2?.isCollapsed).toBe(false); // current starts expanded

    // First click on ch1 expands it immediately
    panel.toggleCollapse('chapters:ch_1');
    expect(ch1?.isCollapsed).toBe(false);

    // Second click on ch1 collapses it back
    panel.toggleCollapse('chapters:ch_1');
    expect(ch1?.isCollapsed).toBe(true);

    // Click on current chapter ch2 collapses it as well
    panel.toggleCollapse('chapters:ch_2');
    expect(ch2?.isCollapsed).toBe(true);

    // Volume collapse toggle
    expect(panel.isVolumeCollapsed.value).toBe(false);
    panel.toggleVolumeCollapse();
    expect(panel.isVolumeCollapsed.value).toBe(true);
    panel.toggleVolumeCollapse();
    expect(panel.isVolumeCollapsed.value).toBe(false);
  });
});
