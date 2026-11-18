import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import * as api from '@/services/api.client';
import { chapterService } from '@/services/chapter.service';
import { appAlert } from '@worldwiki/components';
import {
  removeTodoFromState,
  cascadeUnblockDependencies,
  buildChapterArcGroups,
} from './planningPanel.utils';
import { createPlanningOutliningActions } from './planningPanelOutlining.utils';
import { assembleTapestryVolumeBlocks } from './planningPanelTapestry.utils';
import type { TapestryChapterNode, TapestryTodo, TapestryVolumeBlock } from './PlanningPanel.model';
import type { StoryArc } from '@/stores/story_arcs.store';

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
}));

vi.mock('@/services/api.client', () => ({
  assignChapter: vi.fn().mockResolvedValue(undefined),
  createVolume: vi.fn().mockResolvedValue({ id: 'volumes:v2' }),
  getChapterHierarchy: vi.fn().mockResolvedValue({ volumes: [], chapters: [] }),
  bindChapterToArc: vi.fn().mockResolvedValue(undefined),
  getStoryArcs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/chapter.service', () => ({
  chapterService: {
    createNew: vi.fn((title: string) => ({ id: 'chapters:new', title, content: '', word_count: 0 })),
    save: vi.fn().mockResolvedValue('chapters:new'),
  },
}));

describe('planningPanel utils & outlining', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('removeTodoFromState removes from arcGroups, standaloneTodos, and backlog', () => {
    const ch: TapestryChapterNode = {
      chapterId: 'chapters:1',
      title: 'Ch1',
      sortOrder: 1,
      isCurrent: false,
      isCollapsed: false,
      arcGroups: [
        {
          arcId: 'arcs:1',
          title: 'Arc 1',
          color: null,
          phase: null,
          phaseLabel: 'Развитие',
          todos: [{ id: 'todos:a1', owner_id: 'chapters:1', text: 'A1', status: 'done', done: true, sort_order: 1 }],
        },
      ],
      standaloneTodos: [
        { id: 'todos:s1', owner_id: 'chapters:1', text: 'S1', status: 'done', done: true, sort_order: 2 },
      ],
      doneCount: 2,
      totalCount: 2,
    };
    const backlog: TapestryTodo[] = [
      { id: 'todos:b1', owner_id: 'volumes:1', text: 'B1', status: 'planned', done: false, sort_order: 1 },
    ];

    removeTodoFromState([ch], backlog, 'todos:a1', true);
    expect(ch.arcGroups[0].todos).toHaveLength(0);
    expect(ch.doneCount).toBe(1);

    removeTodoFromState([ch], backlog, 'todos:s1', true);
    expect(ch.standaloneTodos).toHaveLength(0);
    expect(ch.doneCount).toBe(0);

    removeTodoFromState([ch], backlog, 'todos:b1', false);
    expect(backlog).toHaveLength(0);
  });

  it('cascadeUnblockDependencies unblocks blocked todos in both arcGroups and standaloneTodos', () => {
    const ch: TapestryChapterNode = {
      chapterId: 'chapters:1',
      title: 'Ch1',
      sortOrder: 1,
      isCurrent: false,
      isCollapsed: false,
      arcGroups: [
        {
          arcId: 'arcs:1',
          title: 'Arc 1',
          color: null,
          phase: null,
          phaseLabel: 'Развитие',
          todos: [{ id: 't2', owner_id: 'chapters:1', text: 'T2', status: 'blocked', done: false, sort_order: 1, depends_on: 'todos:parent' }],
        },
      ],
      standaloneTodos: [
        { id: 't3', owner_id: 'chapters:1', text: 'T3', status: 'blocked', done: false, sort_order: 2, depends_on: 'parent' },
      ],
      doneCount: 0,
      totalCount: 2,
    };

    const unblocked = cascadeUnblockDependencies([ch], 'todos:parent');
    expect(unblocked).toHaveLength(2);
    expect(unblocked.every((u) => u.status === 'planned')).toBe(true);
  });

  it('buildChapterArcGroups groups bound arcs, unbound arc_id todos, and standalone todos', () => {
    const arcs: StoryArc[] = [
      { id: 'story_arcs:a1', title: 'Arc 1', color: '#111', arc_type: 'plot', status: 'active', project_id: 'p1', description: null },
    ];
    const arcChapters = new Map([['story_arcs:a1', [{ chapter_id: 'chapters:1', phase: 'climax' }]]]);
    const todos: TapestryTodo[] = [
      { id: 't1', owner_id: 'chapters:1', text: 'In bound arc', status: 'planned', done: false, sort_order: 1, arc_id: 'story_arcs:a1' },
      { id: 't2', owner_id: 'chapters:1', text: 'In unbound arc', status: 'planned', done: false, sort_order: 2, arc_id: 'story_arcs:a2', arc_title: 'Fallback Arc' },
      { id: 't3', owner_id: 'chapters:1', text: 'Standalone', status: 'planned', done: false, sort_order: 3, arc_id: null },
    ];

    const res = buildChapterArcGroups(todos, '1', arcs, arcChapters);
    expect(res.arcGroups).toHaveLength(2);
    expect(res.standaloneTodos).toHaveLength(1);
  });

  it('createPlanningOutliningActions handles chapter/volume creation, cancellation, errors, and attachArc', async () => {
    const volumeBlocks = ref<TapestryVolumeBlock[]>([
      {
        volumeId: 'volumes:v1',
        cleanVolumeId: 'v1',
        title: 'Vol 1',
        isCollapsed: false,
        chapters: [],
        backlogTodos: [],
        chapterOptions: [],
        stats: { total: 0, done: 0, inProgress: 0, planned: 0, blocked: 0 },
      },
    ]);
    const chaptersList = ref<TapestryChapterNode[]>([]);
    const expandedChapters = ref(new Set<string>());
    const manuallyCollapsedChapters = ref(new Set<string>());
    const collapsedVolumeIds = ref(new Set<string>());
    const loadTapestryData = vi.fn().mockResolvedValue(undefined);
    const emit = vi.fn();

    const actions = createPlanningOutliningActions({
      currentProject: computed(() => 'proj-1'),
      resolvedVolumeId: computed(() => 'volumes:v1'),
      volumeBlocks,
      chaptersList,
      expandedChapters,
      manuallyCollapsedChapters,
      collapsedVolumeIds,
      loadTapestryData,
      emit,
    });

    actions.startAddingChapter('volumes:v1');
    expect(actions.addingChapterVolumeId.value).toBe('volumes:v1');
    await actions.addPlannedChapter('volumes:v1', '   '); // empty title cancels
    expect(actions.addingChapterVolumeId.value).toBeNull();

    actions.startAddingChapter('volumes:v1');
    actions.newChapterTitle.value = 'Новая глава';
    await actions.addPlannedChapter('volumes:v1');
    expect(chapterService.save).toHaveBeenCalled();
    expect(chaptersList.value).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith('change');

    // Error branch on addPlannedChapter
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(chapterService.save).mockRejectedValueOnce(new Error('save fail'));
    await actions.addPlannedChapter('volumes:v1', 'Fail Chapter');
    expect(appAlert).toHaveBeenCalledWith('Не удалось запланировать главу');

    // Volume add empty + success + error
    actions.startAddVolume();
    await actions.submitAddVolume();
    expect(actions.isAddingVolume.value).toBe(false);

    actions.startAddVolume();
    actions.newVolumeTitle.value = 'Том 2';
    await actions.submitAddVolume();
    expect(api.createVolume).toHaveBeenCalledWith('proj-1', 'Том 2');

    actions.startAddVolume();
    actions.newVolumeTitle.value = 'Том Fail';
    vi.mocked(api.createVolume).mockRejectedValueOnce(new Error('vol fail'));
    await actions.submitAddVolume();
    expect(appAlert).toHaveBeenCalledWith('Не удалось создать новый том');

    // attachArc success + error
    await actions.attachArc({ chapterId: 'chapters:1', arcId: 'arcs:1' });
    expect(loadTapestryData).toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it('assembleTapestryVolumeBlocks assigns chapters without volume_id to first volume', () => {
    const res = assembleTapestryVolumeBlocks({
      rawVolumes: [{ id: 'volumes:v1', title: 'Vol 1' }],
      allChapters: [{ id: 'chapters:1', title: 'Ch1', sort_order: 1 } as never],
      volBacklogs: [[]],
      chTodos: [[]],
      currentCleanId: null,
      expandedChapters: new Set(),
      collapsedVolumeIds: new Set(),
      allProjectArcs: [],
      arcChapters: new Map(),
    });
    expect(res.blocks[0].chapters).toHaveLength(1);
  });

  it('covers getCleanId, getPhaseLabel, normalizeTodo, insert/decrement/removeTodoInBlocks, and buildChapterArcGroups fallbacks', async () => {
    const utils = await import('./planningPanel.utils');
    expect(utils.getCleanId(null)).toBe('');
    expect(utils.getCleanId({ id: 'chapters:99' })).toBe('99');
    expect(utils.getPhaseLabel('setup')).toContain('Завязка');
    expect(utils.getPhaseLabel('resolution')).toContain('Развязка');
    expect(utils.getPhaseLabel('other')).toContain('Развитие');

    const normDone = utils.mapToTapestryTodo({ is_done: true } as any);
    expect(normDone.status).toBe('done');
    expect(normDone.id).toBe('');

    const normPlanned = utils.mapToTapestryTodo({ is_done: false, sort_order: 2 } as any);
    expect(normPlanned.status).toBe('planned');

    // insertTodoIntoBlocks with existing & new arc group + volume backlog
    const blocks: TapestryVolumeBlock[] = [
      {
        volumeId: 'volumes:v1',
        cleanVolumeId: 'v1',
        title: 'Vol 1',
        isCollapsed: false,
        chapters: [
          {
            id: 'chapters:1',
            chapterId: 'chapters:1',
            cleanId: '1',
            title: 'Ch1',
            isCurrent: false,
            isExpanded: false,
            arcGroups: [{ arcId: 'story_arcs:a1', title: 'Arc 1', color: '#000', phase: null, phaseLabel: '', todos: [] }],
            standaloneTodos: [],
            doneCount: 1,
            totalCount: 1,
          },
        ],
        backlogTodos: [{ id: 'b1', owner_id: 'volumes:v1', text: 'B1', status: 'done', done: true, sort_order: 1 }],
        chapterOptions: [],
        stats: { total: 0, done: 0, inProgress: 0, planned: 0, blocked: 0 },
      },
    ];

    const chaptersList = blocks[0].chapters;
    const backlogList = blocks[0].backlogTodos;

    utils.insertTodoIntoState(
      chaptersList,
      backlogList,
      { id: 't1', owner_id: 'chapters:1', arc_id: 'story_arcs:a1', text: 'T1', status: 'planned', done: false, sort_order: 1 },
      'chapters:1',
      'story_arcs:a1',
      'volumes:v1'
    );
    utils.insertTodoIntoState(
      chaptersList,
      backlogList,
      { id: 't2', owner_id: 'chapters:1', arc_id: 'story_arcs:a2', text: 'T2', status: 'planned', done: false, sort_order: 2 },
      'chapters:1',
      'story_arcs:a2',
      'volumes:v1'
    );
    utils.insertTodoIntoState(
      chaptersList,
      backlogList,
      { id: 'b2', owner_id: 'volumes:v1', text: 'B2', status: 'done', done: true, sort_order: 2 },
      'volumes:v1',
      null,
      'volumes:v1'
    );
    expect(chaptersList[0].arcGroups).toHaveLength(2);
    expect(backlogList).toHaveLength(2);

    utils.removeTodoFromState(chaptersList, backlogList, 't1', true);
    utils.removeTodoFromState(chaptersList, backlogList, 'b1', true);
    expect(backlogList).toHaveLength(1);

    // buildChapterArcGroups with empty arc id, out fallback, and duplicate arc_id todos
    const arcGroupsRes = utils.buildChapterArcGroups(
      [
        { id: 't1', owner_id: 'chapters:1', arc_id: 'story_arcs:a1', text: 'T1', status: 'planned', done: false, sort_order: 1 },
        { id: 't2', owner_id: 'chapters:1', arc_id: 'story_arcs:a1', text: 'T2', status: 'planned', done: false, sort_order: 2 },
        { id: 't3', owner_id: 'chapters:1', arc_id: 'story_arcs:a3', text: 'T3', status: 'planned', done: false, sort_order: 3 },
      ],
      '1',
      [{ id: '', title: 'NoId' } as any, { id: 'story_arcs:a1', title: 'Arc 1' } as any],
      new Map([['story_arcs:a1', [{ out: 'chapters:1' } as any]]])
    );
    expect(arcGroupsRes.arcGroups.find((g) => g.arcId === 'story_arcs:a1')?.todos).toHaveLength(2);
  });
});
