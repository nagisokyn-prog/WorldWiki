/**
 * @file shell.manuscript.ts
 * @description Доменная логика структуры произведения: главы, тома, арки
 */

import type { Ref } from 'vue';
import * as api from '../../services/api.client';
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

  const compareIds = (id1: unknown, id2: unknown) => {
    if (!id1 && !id2) return true;
    if (!id1 || !id2) return false;
    const s1 = typeof id1 === 'object' && id1 !== null && 'id' in id1 ? String((id1 as { id: unknown }).id) : String(id1);
    const s2 = typeof id2 === 'object' && id2 !== null && 'id' in id2 ? String((id2 as { id: unknown }).id) : String(id2);
    return s1.split(':').pop() === s2.split(':').pop();
  };

  const closeEditorsFor = (predicate: (e: EditorTab) => boolean) => {
    for (const ed of deps.openEditors.value.filter(predicate)) {
      deps.closeEditor(ed.id, true);
      if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'chapter' && deps.activeTreeNode.value.node.id === ed.id) {
        deps.activeTreeNode.value = null;
      }
    }
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

  const createChapterIn = async ({ arcId, volumeId }: { arcId?: string; volumeId?: string } = {}) => {
    if (isCreatingChapter) return;
    isCreatingChapter = true;
    try {
      const hierarchy = await api.getChapterHierarchy(deps.projectName.value);
      const allChapters = hierarchy.chapters || [];
      let maxNum = 0;
      let relevantCount = 0;
      if (Array.isArray(allChapters)) {
        const relevantChapters = allChapters.filter((c) => {
          const cArcId = c.arc_id ? String(c.arc_id) : null;
          const cVolId = c.volume_id ? String(c.volume_id) : null;
          const targetArcId = arcId ? String(arcId) : null;
          const targetVolId = volumeId ? String(volumeId) : null;
          if (targetArcId) return cArcId === targetArcId;
          if (targetVolId) return cVolId === targetVolId && !cArcId;
          return !cArcId && !cVolId;
        });
        relevantCount = relevantChapters.length;
        relevantChapters.forEach((c) => {
          const m = (c.title || '').match(/Глава\s*(\d+)/i);
          if (m) {
            const n = parseInt(m[1]);
            if (n > maxNum) maxNum = n;
          }
        });
      }
      const num = maxNum + 1;
      deps.addLog(`Manuscript -> Next chapter number: ${num} (found ${relevantCount} in this section)`, 'info');
      const newCh: Chapter = {
        id: `chapters:chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        project_id: `projects:${deps.projectName.value}`,
        title: `Глава ${num}`,
        content: '# Новая глава\n\n',
        summary: undefined,
        word_count: 0 as unknown as bigint,
        embeddings: {},
        footnotes: {},
        timeline_events: [],
        participants: [],
        arc_id: arcId || null,
        volume_id: volumeId || null,
      } as unknown as Chapter;
      const saveRes = await api.saveChapter(deps.projectName.value, newCh);
      if (saveRes && saveRes.id) newCh.id = saveRes.id;
      if ((arcId || volumeId) && newCh.id) await api.assignChapter(deps.projectName.value, newCh.id, arcId || null, volumeId || null);
      deps.addLog('Manuscript -> Created new chapter', 'success');
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load(newCh.id || undefined);
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      if (deps.chapters.value) {
        deps.chapters.value = [...deps.chapters.value, newCh];
      }
      deps.openChapterTab(newCh);
    } catch (e) {
      deps.addLog(`Manuscript -> Error creating chapter: ${e}`, 'error');
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
      let fallbackPoint: api.AutoExtendResult | null = null;

      if (idx !== -1) {
        // Если перед удаляемой есть глава — берём её (Глава N-1)
        if (idx > 0) {
          const prev = chaps[idx - 1] as unknown as Record<string, unknown>;
          const prevId = String(prev.id || '');
          if (prevId) {
            fallbackPoint = {
              chapter_id: prevId,
              arc_id: (prev.arc_id as string) || (prev.arcId as string) || null,
              volume_id: (prev.volume_id as string) || (prev.volumeId as string) || null,
              updated_count: 0
            };
          }
        } else if (chaps.length > 1) {
          // Если удалили первую главу, берем следующую оставшуюся
          const next = chaps[1] as unknown as Record<string, unknown>;
          const nextId = String(next.id || '');
          if (nextId) {
            fallbackPoint = {
              chapter_id: nextId,
              arc_id: (next.arc_id as string) || (next.arcId as string) || null,
              volume_id: (next.volume_id as string) || (next.volumeId as string) || null,
              updated_count: 0
            };
          }
        }
      }

      // 2. Исцеляем точки сущностей в SurrealDB до физического удаления главы
      try {
        await api.healDeletedChapter(deps.projectName.value, chapter.id, fallbackPoint);
      } catch (healErr) {
        console.warn('[Timeline AutoHeal] Failed to heal points on backend:', healErr);
      }

      await api.deleteChapter(chapter.id);
      deps.addLog(`Manuscript -> Deleted chapter ${chapter.title || chapter.id}`, 'success');
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      deps.closeEditor(chapter.id);
    } catch (e) {
      deps.addLog(`Manuscript -> Error deleting chapter: ${e}`, 'error');
    }
  };

  const renameChapter = async (chapter: { id?: string | null }, newTitle: string) => {
    if (!chapter.id) return;
    try {
      const targetId = chapter.id;
      deps.chapters.value = deps.chapters.value.map((c) => c.id === targetId ? { ...c, title: newTitle } : c);
      const fullData = await api.getChapter(targetId);
      if (fullData) {
        fullData.title = newTitle;
        await api.saveChapter(deps.projectName.value, fullData);
      }
      deps.addLog(`Chapter renamed: ${newTitle}`, 'success');
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    } catch (e) {
      console.error('Failed to rename chapter:', e);
      deps.addLog(`Error renaming chapter: ${e}`, 'error');
    }
  };

  const onChapterRenamed = ({ id, title }: { id: string; title: string }) => {
    deps.updateTabData(id, { title });
  };

  const deleteVolume = async (volume: { id: string; title?: string; [key: string]: unknown }, chaptersInVol: Array<{ id: string }> = [], arcsInVol: string[] = [], silent = false) => {
    const { appConfirm } = await import('@worldwiki/components');
    if (!silent && !await appConfirm(`Удалить том "${volume.title}" и все его содержимое?`)) return;
    try {
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.volume_id, volume.id) ||
          arcsInVol.some(arcId => compareIds(e.data.arc_id, arcId)) ||
          chaptersInVol.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInVol) {
        try { await api.deleteChapter(ch.id); } catch (err) { console.error('Ошибка удаления главы (vol):', err); }
        deps.closeEditor(String(ch.id), true);
        if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'chapter' && deps.activeTreeNode.value.node.id === ch.id) {
          deps.activeTreeNode.value = null;
        }
      }
      for (const arcId of arcsInVol) {
        await api.deleteArc(arcId);
        if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'arc' && deps.activeTreeNode.value.node.id === arcId) {
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

  const deleteArc = async (arc: { id: string; title?: string; [key: string]: unknown }, chaptersInArc: Array<{ id: string }> = [], silent = false) => {
    const { appConfirm } = await import('@worldwiki/components');
    if (!silent && !await appConfirm(`Удалить арку "${arc.title}" и все ее главы?`)) return;
    try {
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.arcId, arc.id) ||
          chaptersInArc.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInArc) {
        try { await api.deleteChapter(ch.id); } catch (err) { console.error('Ошибка удаления главы (arc):', err); }
        deps.closeEditor(String(ch.id), true);
        if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'chapter' && deps.activeTreeNode.value.node.id === ch.id) {
          deps.activeTreeNode.value = null;
        }
      }
      await api.deleteArc(arc.id);
      deps.addLog(`Deleted arc [${arc.id}]`, 'warn');
      if (deps.activeTreeNode.value && deps.activeTreeNode.value.type === 'arc' && deps.activeTreeNode.value.node.id === arc.id) {
        deps.activeTreeNode.value = null;
      }
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      deps.addToast(`Арка "${arc.title}" удалена`, 'warn');
      if (deps.currentSidebarTab.value === 'chapters') deps.loadEntityList('chapters');
    } catch (e) {
      deps.addLog(`Error deleting arc: ${e}`, 'error');
    }
  };

  return {
    loadChapters,
    createChapterIn,
    deleteChapter,
    renameChapter,
    onChapterRenamed,
    deleteVolume,
    deleteArc
  };
}
