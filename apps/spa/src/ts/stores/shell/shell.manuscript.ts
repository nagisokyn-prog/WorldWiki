/**
 * @file shell.manuscript.ts
 * @description Доменная логика структуры произведения: главы, тома
 */

import { ref, type Ref } from 'vue';
import * as api from '../../services/api.client';
import { projectRecordId } from '../../services/api/project.api';
import type { Chapter } from '../../types/generated/Chapter';
import type { EditorTab } from './shell.types';

export interface ManuscriptDeps {
  projectName: Ref<string>;
  chapters: Ref<Chapter[]>;
  chapterTreeRef: Ref<{ load?: (targetId?: string) => Promise<void> } | null>;
  activeTreeNode: Ref<{ type: string; node: { id?: string; [key: string]: unknown } } | null>;
  currentSidebarTab: Ref<string | null>;
  openEditors: Ref<EditorTab[]>;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  openChapterTab: (chapter: Chapter) => void;
  closeEditor: (tabId: string, force?: boolean) => void;
  loadEntityList: (type: string) => Promise<void>;
  updateTabData: (tabId: string, data: Partial<EditorTab>) => void;
}

export function useShellManuscript(deps: ManuscriptDeps) {
  let isCreatingChapter = false;
  const isCreateChapterModalOpen = ref(false);
  const createChapterTargetVolumeId = ref<string | null>(null);

  const openCreateChapterModal = (volumeId?: string | null) => {
    createChapterTargetVolumeId.value = volumeId || null;
    isCreateChapterModalOpen.value = true;
  };

  const closeCreateChapterModal = () => {
    isCreateChapterModalOpen.value = false;
    createChapterTargetVolumeId.value = null;
  };

  const compareIds = (id1: unknown, id2: unknown) => {
    if (!id1 && !id2) return true;
    if (!id1 || !id2) return false;
    const s1 = typeof id1 === 'object' && id1 !== null && 'id' in id1 ? String((id1 as { id: unknown }).id) : String(id1);
    const s2 = typeof id2 === 'object' && id2 !== null && 'id' in id2 ? String((id2 as { id: unknown }).id) : String(id2);
    return s1.split(':').pop() === s2.split(':').pop();
  };

  const loadChapters = async () => {
    try {
      const list = await api.getChapters(deps.projectName.value);
      deps.chapters.value = list;
      deps.addLog(`Manuscript -> Loaded ${list.length} chapters`, 'info');
    } catch (e) {
      deps.addLog(`Manuscript -> Error loading chapters: ${e}`, 'error');
    }
  };

  const createChapterIn = ({ volumeId }: { volumeId?: string | null } = {}) => {
    openCreateChapterModal(volumeId);
  };

  const confirmCreateChapter = async ({ title, volumeId }: { title: string; volumeId: string | null }) => {
    if (isCreatingChapter) return;
    isCreatingChapter = true;
    try {
      const trimmedTitle = title.trim();
      const newCh: Chapter = {
        id: `chapters:chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectRecordId(deps.projectName.value),
        title: trimmedTitle,
        content: `# ${trimmedTitle}\n\n`,
        summary: undefined,
        word_count: 0 as unknown as bigint,
        embeddings: {},
        footnotes: {},
        timeline_events: [],
        participants: [],
        volume_id: volumeId || null,
      } as unknown as Chapter;
      const saveRes = await api.saveChapter(newCh);
      if (saveRes && saveRes.id) newCh.id = saveRes.id;
      if (volumeId && newCh.id) await api.assignChapter(deps.projectName.value, newCh.id, volumeId || null);
      deps.addLog(`Manuscript -> Created chapter "${trimmedTitle}"`, 'success');
      if (deps.chapterTreeRef.value?.load) await deps.chapterTreeRef.value.load(newCh.id || undefined);
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      if (deps.chapters.value) {
        deps.chapters.value = [...deps.chapters.value, newCh];
      }
      deps.openChapterTab(newCh);
      closeCreateChapterModal();
    } catch (e) {
      console.error('[confirmCreateChapter] Error:', e);
      deps.addLog(`Manuscript -> Error creating chapter: ${e}`, 'error');
      deps.addToast(`Ошибка создания главы: ${e}`, 'error');
    } finally {
      isCreatingChapter = false;
    }
  };

  const deleteChapter = async (chapter: { id?: string | null; title?: string }, _silent = false) => {
    if (!chapter.id) return;
    try {
      // 1. Вычисляем предшествующую главу перед удалением для автоотката таймлайна
      const chaps = deps.chapters.value || [];
      const cleanTargetId = String(chapter.id).replace(/^[^:]+:/, '');
      const idx = chaps.findIndex(c => String(c.id).replace(/^[^:]+:/, '') === cleanTargetId);
      let fallbackPoint: { computed_epoch: number; computed_minute: number } | null = null;
      if (idx > 0) {
        const prevChapter = chaps[idx - 1];
        try {
          const detail = await api.getChapter(String(prevChapter.id));
          if (detail && detail.summary) {
            try {
              const parsed = typeof detail.summary === 'string' ? JSON.parse(detail.summary) as Record<string, unknown> : detail.summary as Record<string, unknown>;
              if (parsed && parsed.end_point_abs != null) {
                fallbackPoint = {
                  computed_epoch: typeof parsed.end_epoch === 'number' ? parsed.end_epoch : 1,
                  computed_minute: Number(parsed.end_point_abs)
                };
              }
            } catch (err: unknown) {
              console.warn('[deleteChapter] Could not parse chapter summary for timeline fallback:', err);
            }
          }
        } catch (e) {
          console.warn('[deleteChapter] Could not fetch previous chapter summary for fallback:', e);
        }
      }

      await api.deleteChapter(chapter.id);
      deps.addLog(`Deleted chapter [${chapter.id}]`, 'warn');
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      deps.closeEditor(chapter.id, true);
      if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'chapter' && compareIds(deps.activeTreeNode.value.node.id, chapter.id)) {
        deps.activeTreeNode.value = null;
      }
      deps.addToast(`Глава "${chapter.title || 'Безымянная'}" удалена`, 'warn');
      if (deps.currentSidebarTab.value === 'chapters') deps.loadEntityList('chapters');

      // Публикуем событие отката таймлайна, если есть предыдущая глава
      if (fallbackPoint) {
        document.dispatchEvent(new CustomEvent('ww:chapter-deleted-timeline-rollback', {
          detail: {
            deletedChapterId: chapter.id,
            fallbackPoint
          }
        }));
      }
    } catch (e) {
      deps.addLog(`Error deleting chapter: ${e}`, 'error');
    }
  };

  const renameChapter = async (chapterId: string, newTitle: string) => {
    try {
      const chapter = await api.getChapter(chapterId);
      if (chapter) {
        chapter.title = newTitle;
        await api.saveChapter(chapter);
        deps.updateTabData(chapterId, { title: newTitle });
        deps.addLog(`Manuscript -> Renamed chapter to: ${newTitle}`, 'info');
        if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
        if (deps.currentSidebarTab.value === 'chapters') deps.loadEntityList('chapters');
        document.dispatchEvent(new CustomEvent('ww:chapter-renamed', {
          detail: { id: chapterId, title: newTitle }
        }));
      }
    } catch (e) {
      deps.addLog(`Error renaming chapter: ${e}`, 'error');
    }
  };

  const onChapterRenamed = (data: { id: string; title: string }) => {
    deps.updateTabData(data.id, { title: data.title });
    if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
    if (deps.currentSidebarTab.value === 'chapters') deps.loadEntityList('chapters');
  };

  const deleteVolume = async (volume: { id: string; title?: string }) => {
    try {
      const hierarchy = await api.getChapterHierarchy(deps.projectName.value);
      const chaptersInVol = (hierarchy.chapters || []).filter(
        c => c.volume_id && (
          String(c.volume_id) === String(volume.id) ||
          String(c.volume_id).split(':').pop() === String(volume.id).split(':').pop()
        )
      );
      for (const ch of chaptersInVol) {
        if (!ch.id) continue;
        try { await api.deleteChapter(ch.id); } catch (err) { console.error('Ошибка удаления главы (vol):', err); }
        deps.closeEditor(String(ch.id), true);
        if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'chapter' && deps.activeTreeNode.value.node.id === ch.id) {
          deps.activeTreeNode.value = null;
        }
      }
      await api.deleteVolume(volume.id);
      deps.addLog(`Deleted volume [${volume.id}]`, 'warn');
      if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'volume' && deps.activeTreeNode.value.node.id === volume.id) {
        deps.activeTreeNode.value = null;
      }
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      deps.addToast(`Том "${volume.title}" удален`, 'warn');
      if (deps.currentSidebarTab.value === 'chapters') deps.loadEntityList('chapters');
    } catch (e) {
      deps.addLog(`Error deleting volume: ${e}`, 'error');
    }
  };

  return {
    loadChapters,
    createChapterIn,
    openCreateChapterModal,
    closeCreateChapterModal,
    confirmCreateChapter,
    isCreateChapterModalOpen,
    createChapterTargetVolumeId,
    deleteChapter,
    renameChapter,
    onChapterRenamed,
    deleteVolume
  };
}
