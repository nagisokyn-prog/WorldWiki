import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlanningPanel } from '../usePlanningPanel';
import * as api from '@/services/api.client';
import { chapterService } from '@/services/chapter.service';
import { setActivePinia, createPinia } from 'pinia';
import { useChapterStore } from '@/stores/chapter.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
  appConfirm: vi.fn(),
}));

vi.mock('@/services/api.client', () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  toggleTodo: vi.fn(),
  setTodoStatus: vi.fn(),
  deleteTodo: vi.fn(),
  createChapter: vi.fn(),
  createVolume: vi.fn(),
  assignChapter: vi.fn(),
  getChapterHierarchy: vi.fn(),
  getStoryArcs: vi.fn(),
}));

vi.mock('@/services/chapter.service', () => ({
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
      { id: 'story_arcs:arc_1', title: 'Возвращение домой', color: 'var(--accent)', arc_type: 'plot', status: 'active', project_id: 'proj_1', description: null }
    ];
    arcsStore.arcChapters.set('story_arcs:arc_1', [
      { chapter_id: 'chapters:ch_2', phase: 'escalation' }
    ]);
    vi.mocked(api.getStoryArcs).mockResolvedValue(arcsStore.arcs as any);
    vi.mocked(api.getChapterHierarchy).mockResolvedValue({ volumes: [], chapters: [] } as any);

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

  it('computes totalStats, allVolumeTodos, selectVolume, toggleHelp, addBacklogToVolume, handleNavigate, and load error', async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    const classList = { add: vi.fn(), remove: vi.fn() };
    const getByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView,
      classList,
    } as unknown as HTMLElement);

    vi.mocked(api.getTodos).mockResolvedValue([
      { id: 't1', owner_id: 'chapters:ch_2', text: 'Task 1', arc_id: 'story_arcs:arc_1', status: 'planned', is_done: false, sort_order: 1 },
      { id: 't2', owner_id: 'chapters:ch_2', text: 'Task 2', arc_id: null, status: 'done', is_done: true, sort_order: 2 },
    ] as never);

    const emit = vi.fn();
    const panel = usePlanningPanel(props, emit);
    await panel.load();

    expect(panel.totalStats.value.total).toBeGreaterThan(0);
    expect(panel.allVolumeTodos.value.length).toBeGreaterThan(0);

    panel.toggleHelp();
    expect(panel.isHelpOpen.value).toBe(true);

    panel.handleNavigate('chapters:ch_1');
    expect(emit).toHaveBeenCalledWith('select-chapter', 'chapters:ch_1');
    await Promise.resolve();
    vi.advanceTimersByTime(1900);
    expect(scrollIntoView).toHaveBeenCalled();
    expect(classList.add).toHaveBeenCalledWith('chapter-card-highlight');
    expect(classList.remove).toHaveBeenCalledWith('chapter-card-highlight');

    panel.selectVolume('volumes:vol_1');
    await panel.addBacklogToVolume('volumes:vol_1', { text: 'Backlog X' });
    expect(api.createTodo).toHaveBeenCalled();

    // Error branch in loadTapestryData
    const { appAlert } = await import('@worldwiki/components');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chapterStore = useChapterStore();
    chapterStore.hierarchy = { volumes: [], chapters: [] };
    vi.spyOn(chapterStore, 'loadChapters').mockRejectedValueOnce(new Error('load fail'));
    await panel.load();
    expect(appAlert).toHaveBeenCalledWith('Не удалось загрузить задачи плана');

    errSpy.mockRestore();
    getByIdSpy.mockRestore();
    vi.useRealTimers();
  });

  it('covers resolvedVolumeId/volumeTitle fallbacks, props.arcsList, remaining chapters, and outlining volume actions', async () => {
    const chapterStore = useChapterStore();
    chapterStore.hierarchy = {
      volumes: [{ id: 'volumes:v1', title: '' }],
      chapters: [
        { id: 'chapters:c1', volume_id: 'volumes:other', title: 'Сирота', sort_order: 1 } as any,
      ],
    };
    chapterStore.selectedVolumeId = 'volumes:v1';
    vi.mocked(api.getTodos).mockResolvedValue([]);

    const customArcs = [
      { id: 'story_arcs:a1', title: 'Arc 1', color: null, arc_type: 'plot', status: 'active', project_id: 'p1', description: null },
    ];
    const panel = usePlanningPanel({
      project: 'proj_1',
      arcsList: customArcs as any,
    });
    expect(panel.allProjectArcs.value).toEqual(customArcs);
    expect(panel.resolvedVolumeId.value).toBe('volumes:v1');
    expect(panel.volumeTitle.value).toBe('Рукопись тома');

    await panel.load();
    // remainingChapters attached to blocks[0]
    expect(panel.volumeBlocks.value[0].chapters.some((c) => c.chapterId === 'chapters:c1')).toBe(true);

    // Outlining volume actions
    panel.startAddVolume();
    expect(panel.isAddingVolume.value).toBe(true);
    panel.cancelAddVolume();
    expect(panel.isAddingVolume.value).toBe(false);

    // Empty title guard in addPlannedChapter
    await panel.addPlannedChapter('volumes:v1', '   ');
    // Error branch in addPlannedChapter
    const { appAlert } = await import('@worldwiki/components');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(chapterService.save).mockRejectedValueOnce(new Error('save fail'));
    await panel.addPlannedChapter('volumes:v1', 'Новая глава');
    expect(appAlert).toHaveBeenCalled();

    // submitAddChapter
    vi.mocked(chapterService.save).mockResolvedValueOnce('chapters:ch_new');
    panel.newChapterTitle.value = 'Глава из инпута';
    await panel.submitAddChapter('volumes:v1');

    // submitAddVolume: empty title, success, and error
    panel.newVolumeTitle.value = '   ';
    await panel.submitAddVolume();
    panel.newVolumeTitle.value = 'Том 2';
    await panel.submitAddVolume();
    expect(api.createVolume).toHaveBeenCalledWith('proj_1', 'Том 2');
    vi.mocked(api.createVolume).mockRejectedValueOnce(new Error('vol err'));
    panel.newVolumeTitle.value = 'Том 3';
    await panel.submitAddVolume();

    // attachArc: string form + error
    const arcsStore = useStoryArcsStore();
    vi.spyOn(arcsStore, 'bindChapter').mockResolvedValueOnce(undefined);
    await panel.attachArc('chapters:c1', 'story_arcs:a1');
    vi.spyOn(arcsStore, 'bindChapter').mockRejectedValueOnce(new Error('bind err'));
    await panel.attachArc({ chapterId: 'chapters:c1', arcId: 'story_arcs:a1' });

    // saveTodo & addBacklog without volume
    await panel.saveTodo({ id: 't1', owner_id: 'chapters:c1', text: '   ', sort_order: 1 } as any);
    await panel.saveTodo({ id: 't1', owner_id: 'chapters:c1', text: 'Valid', sort_order: 1 } as any);
    vi.mocked(api.createTodo).mockRejectedValueOnce(new Error('save todo err'));
    await panel.saveTodo({ id: 't1', owner_id: 'chapters:c1', text: 'Fail', sort_order: 1 } as any);

    errSpy.mockRestore();
  });
});
