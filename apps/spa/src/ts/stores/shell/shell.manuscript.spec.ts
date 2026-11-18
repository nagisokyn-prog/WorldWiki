import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useShellManuscript, type ManuscriptDeps } from './shell.manuscript';
import type { Chapter } from '@/types/generated/Chapter';
import type { EditorTab } from './shell.types';

const mockGetChapters = vi.fn();
const mockGetChapter = vi.fn();
const mockGetChapterHierarchy = vi.fn();
const mockSaveChapter = vi.fn();
const mockAssignChapter = vi.fn();
const mockDeleteChapter = vi.fn();
const mockDeleteVolume = vi.fn();
const mockAppConfirm = vi.fn();
const mockChapterStore = {
  currentChapter: null as unknown,
  currentChapterId: undefined as string | undefined,
  hasUnsavedChanges: false
};

vi.mock('@/services/api.client', () => ({
  getChapters: (...args: unknown[]) => mockGetChapters(...args),
  getChapter: (...args: unknown[]) => mockGetChapter(...args),
  getChapterHierarchy: (...args: unknown[]) => mockGetChapterHierarchy(...args),
  saveChapter: (...args: unknown[]) => mockSaveChapter(...args),
  assignChapter: (...args: unknown[]) => mockAssignChapter(...args),
  deleteChapter: (...args: unknown[]) => mockDeleteChapter(...args),
  deleteVolume: (...args: unknown[]) => mockDeleteVolume(...args)
}));

vi.mock('@/services/api/project.api', () => ({
  projectRecordId: (p: string) => `projects:${p}`
}));

vi.mock('../chapter.store', () => ({
  useChapterStore: () => mockChapterStore
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: (...args: unknown[]) => mockAppConfirm(...args)
}));

describe('shell.manuscript', () => {
  let deps: ManuscriptDeps;
  let treeLoad: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    treeLoad = vi.fn(async () => {});
    mockChapterStore.currentChapter = null;
    mockChapterStore.currentChapterId = undefined;
    mockChapterStore.hasUnsavedChanges = false;

    deps = {
      projectName: ref('my-proj'),
      chapters: ref<Chapter[]>([]),
      chapterTreeRef: ref({ load: treeLoad }),
      activeTreeNode: ref(null),
      currentSidebarTab: ref<string | null>('chapters'),
      openEditors: ref<EditorTab[]>([]),
      addLog: vi.fn(),
      addToast: vi.fn(),
      openChapterTab: vi.fn(),
      closeEditor: vi.fn(),
      loadEntityList: vi.fn(async () => {}),
      updateTabData: vi.fn()
    };
  });

  it('opens/closes create chapter modal and loads chapters (success & error)', async () => {
    const ms = useShellManuscript(deps);
    ms.openCreateChapterModal('vol:1');
    expect(ms.isCreateChapterModalOpen.value).toBe(true);
    expect(ms.createChapterTargetVolumeId.value).toBe('vol:1');

    ms.closeCreateChapterModal();
    expect(ms.isCreateChapterModalOpen.value).toBe(false);
    expect(ms.createChapterTargetVolumeId.value).toBeNull();

    mockGetChapters.mockResolvedValueOnce([{ id: 'chapters:1', title: 'Глава 1' }]);
    await ms.loadChapters();
    expect(deps.chapters.value).toHaveLength(1);
    expect(deps.addLog).toHaveBeenCalledWith('Manuscript -> Loaded 1 chapters', 'info');

    mockGetChapters.mockRejectedValueOnce(new Error('load err'));
    await ms.loadChapters();
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining('Error loading chapters'), 'error');
  });

  it('creates next chapter in volume or root and handles create errors', async () => {
    const ms = useShellManuscript(deps);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockGetChapterHierarchy.mockResolvedValueOnce({
      chapters: [
        { id: 'c1', title: 'Глава 2', volume_id: 'volumes:v1' },
        { id: 'c2', title: 'Глава 10', volume_id: null }
      ]
    });
    mockSaveChapter.mockResolvedValueOnce({ id: 'chapters:new-1' });
    mockAssignChapter.mockResolvedValueOnce(undefined);

    await ms.createChapterIn({ volumeId: 'v1' });
    expect(mockSaveChapter).toHaveBeenCalledWith(expect.objectContaining({ title: 'Глава 3', volume_id: 'v1' }));
    expect(mockAssignChapter).toHaveBeenCalledWith('my-proj', 'chapters:new-1', 'v1');
    expect(deps.openChapterTab).toHaveBeenCalled();
    expect(treeLoad).toHaveBeenCalledWith('chapters:new-1');

    mockGetChapterHierarchy.mockRejectedValueOnce(new Error('hier err'));
    await ms.createChapterIn();
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining('Error creating chapter'), 'error');

    mockSaveChapter.mockRejectedValueOnce(new Error('save err'));
    await ms.confirmCreateChapter({ title: '  Тест  ', volumeId: null });
    expect(deps.addToast).toHaveBeenCalledWith(expect.stringContaining('Ошибка создания главы'), 'error');

    errSpy.mockRestore();
  });

  it('deletes chapter with timeline rollback fallback, chapterStore reset, and error handling', async () => {
    const ms = useShellManuscript(deps);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // No id -> no-op
    await ms.deleteChapter({});
    expect(mockDeleteChapter).not.toHaveBeenCalled();

    deps.chapters.value = [
      { id: 'chapters:prev', title: 'Prev' } as Chapter,
      { id: 'chapters:target', title: 'Target' } as Chapter
    ];
    deps.activeTreeNode.value = { type: 'chapter', node: { id: 'target' } };
    mockChapterStore.currentChapterId = 'chapters:target';
    mockChapterStore.currentChapter = { id: 'chapters:target' };
    mockChapterStore.hasUnsavedChanges = true;

    mockGetChapter.mockResolvedValueOnce({
      id: 'chapters:prev',
      summary: JSON.stringify({ end_epoch: 2, end_point_abs: 500 })
    });
    mockDeleteChapter.mockResolvedValueOnce(undefined);

    const rollbackEvents: CustomEvent[] = [];
    const listener = (e: Event) => rollbackEvents.push(e as CustomEvent);
    document.addEventListener('ww:chapter-deleted-timeline-rollback', listener);

    await ms.deleteChapter({ id: 'chapters:target', title: 'Target' });

    expect(deps.closeEditor).toHaveBeenCalledWith('chapters:target', true);
    expect(deps.closeEditor).toHaveBeenCalledWith('target', true);
    expect(mockChapterStore.currentChapter).toBeNull();
    expect(mockChapterStore.hasUnsavedChanges).toBe(false);
    expect(deps.chapters.value).toHaveLength(1);
    expect(deps.activeTreeNode.value).toBeNull();
    expect(deps.loadEntityList).toHaveBeenCalledWith('chapters');
    expect(rollbackEvents).toHaveLength(1);
    expect(rollbackEvents[0].detail.fallbackPoint).toEqual({ computed_epoch: 2, computed_minute: 500 });
    document.removeEventListener('ww:chapter-deleted-timeline-rollback', listener);

    // Invalid summary JSON + getChapter reject + deleteChapter error
    deps.chapters.value = [
      { id: 'chapters:p1', title: 'P1' } as Chapter,
      { id: 'chapters:t2', title: 'T2' } as Chapter
    ];
    mockGetChapter.mockResolvedValueOnce({ id: 'chapters:p1', summary: '{bad-json' });
    mockDeleteChapter.mockRejectedValueOnce(new Error('del fail'));
    await ms.deleteChapter({ id: 'chapters:t2' });
    expect(deps.addToast).toHaveBeenCalledWith(expect.stringContaining('Ошибка удаления главы'), 'error');

    warnSpy.mockRestore();
  });

  it('renames chapter, handles onChapterRenamed, and deletes volume (confirmed, cancelled, and error)', async () => {
    const ms = useShellManuscript(deps);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    deps.chapters.value = [{ id: 'chapters:c1', title: 'Old' } as Chapter];
    mockGetChapter.mockResolvedValueOnce({ id: 'chapters:c1', title: 'Old' });
    mockSaveChapter.mockResolvedValueOnce(undefined);

    await ms.renameChapter({ id: 'chapters:c1' }, 'New');
    expect(deps.updateTabData).toHaveBeenCalledWith('chapters:c1', { title: 'New' });
    expect(deps.chapters.value[0].title).toBe('New');

    mockGetChapter.mockRejectedValueOnce(new Error('rename err'));
    await ms.renameChapter('chapters:c1', 'Fail');
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining('Error renaming chapter'), 'error');

    ms.onChapterRenamed({ id: 'chapters:c1', title: 'Synced' });
    expect(deps.updateTabData).toHaveBeenCalledWith('chapter:c1', { title: 'Synced' });
    expect(deps.chapters.value[0].title).toBe('Synced');

    // deleteVolume cancelled
    mockAppConfirm.mockResolvedValueOnce(false);
    await ms.deleteVolume({ id: 'volumes:v1', title: 'Том 1' });
    expect(mockDeleteVolume).not.toHaveBeenCalled();

    // deleteVolume silent with hierarchy fetch & activeTreeNode cleanup
    deps.openEditors.value = [
      { id: 'chapters:c1', tabType: 'chapter', title: 'C1', entityType: 'chapter', rawId: 'c1', unsaved: false, data: { volume_id: 'volumes:v1' } } as EditorTab
    ];
    deps.activeTreeNode.value = { type: 'volume', node: { id: 'v1' } };
    mockGetChapterHierarchy.mockResolvedValueOnce({
      chapters: [{ id: 'chapters:c1', volume_id: 'volumes:v1' }]
    });
    mockDeleteChapter.mockRejectedValueOnce(new Error('ch del err'));
    mockDeleteVolume.mockResolvedValueOnce(undefined);

    await ms.deleteVolume({ id: 'volumes:v1', title: 'Том 1' }, undefined, true);
    expect(mockDeleteVolume).toHaveBeenCalledWith('volumes:v1');
    expect(deps.activeTreeNode.value).toBeNull();
    expect(deps.addToast).toHaveBeenCalledWith('Том "Том 1" удален', 'warn');

    // deleteVolume outer catch
    mockDeleteVolume.mockRejectedValueOnce(new Error('vol err'));
    await ms.deleteVolume({ id: 'volumes:v2' }, [], true);
    expect(deps.addLog).toHaveBeenCalledWith(expect.stringContaining('Error deleting volume'), 'error');

    errSpy.mockRestore();
  });
});
