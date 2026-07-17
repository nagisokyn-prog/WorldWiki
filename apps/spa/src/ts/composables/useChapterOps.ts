import { ref, triggerRef, type ComputedRef } from 'vue';

export function useChapterOps(ctx: {
  projectName: string;
  addLog: (text: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
  addToast: (text: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
  closeEditor: (id: string, force?: boolean) => void;
  openChapterTab: (chapter: any) => void;
  chapterTreeRef?: { value: { load?: (id?: string) => void } | null };
  openEditors: ComputedRef<any[]>;
  lists: {
    chapters: { value: any[] };
    currentSidebarTab: { value: string | null };
    loadEntityList: (entityType: string) => Promise<void>;
  };
  tabs: {
    activeTreeNode: { value: { type: string; node: any } | null };
  };
}) {
  let isCreatingChapter = false;

  const createChapterIn = async ({ arcId, volumeId }: { arcId?: string; volumeId?: string } = {}) => {
    if (isCreatingChapter) return;
    isCreatingChapter = true;
    try {
      const { apiService } = await import('../services/api.service');
      const hierarchy = await apiService.getHierarchy(ctx.projectName);
      const allChapters = hierarchy.chapters || [];
      let maxNum = 0;
      let relevantCount = 0;
      if (Array.isArray(allChapters)) {
        const relevantChapters = allChapters.filter((c: any) => {
          const cArcId = c.arcId ? String(c.arcId) : null;
          const cVolId = c.volumeId ? String(c.volumeId) : null;
          const targetArcId = arcId ? String(arcId) : null;
          const targetVolId = volumeId ? String(volumeId) : null;
          if (targetArcId) return cArcId === targetArcId;
          if (targetVolId) return cVolId === targetVolId && !cArcId;
          return !cArcId && !cVolId;
        });
        relevantCount = relevantChapters.length;
        relevantChapters.forEach((c: any) => {
          const m = (c.title || '').match(/Глава\s*(\d+)/i);
          if (m) {
            const n = parseInt(m[1]);
            if (n > maxNum) maxNum = n;
          }
        });
      }
      const num = maxNum + 1;
      ctx.addLog(`Manuscript -> Next chapter number: ${num} (found ${relevantCount} in this section)`, 'info');
      const newCh: any = {
        id: `chapters:chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: `Глава ${num}`,
        content: '# Новая глава\n\n',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordCount: 0,
        footnotes: {},
        timelineEvents: [],
        participants: [],
        arcId,
        volumeId,
      };
      const saveRes = await apiService.saveChapter(ctx.projectName, newCh);
      if (saveRes && (saveRes as any).id) newCh.id = (saveRes as any).id;
      if (arcId || volumeId) await apiService.assignChapter(ctx.projectName, newCh.id, arcId, volumeId);
      ctx.addLog('Manuscript -> Created new chapter', 'success');
      if (ctx.chapterTreeRef?.value?.load) ctx.chapterTreeRef.value.load(newCh.id);
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      if (ctx.lists.chapters.value) {
        ctx.lists.chapters.value = [...ctx.lists.chapters.value, newCh];
      }
      ctx.openChapterTab(newCh);
    } catch (e) {
      ctx.addLog(`Manuscript -> Error creating chapter: ${e}`, 'error');
    } finally {
      isCreatingChapter = false;
    }
  };

  const deleteChapter = async (chapter: any, silent = false) => {
    try {
      const { apiService } = await import('../services/api.service');
      await apiService.deleteChapter(ctx.projectName, chapter.id);
      ctx.addLog(`Manuscript -> Deleted chapter ${chapter.title}`, 'success');
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      ctx.closeEditor(chapter.id);
    } catch (e) {
      ctx.addLog(`Manuscript -> Error deleting chapter: ${e}`, 'error');
    }
  };

  const renameChapter = async (chapter: any, newTitle: string) => {
    try {
      const { apiService } = await import('../services/api.service');
      ctx.lists.chapters.value = ctx.lists.chapters.value.map((c: any) => c.id === chapter.id ? { ...c, title: newTitle } : c);
      const fullData = await apiService.getChapter(ctx.projectName, chapter.id);
      fullData.title = newTitle;
      await apiService.saveChapter(ctx.projectName, fullData);
      ctx.addLog(`Chapter renamed: ${newTitle}`, 'success');
    } catch (e) {
      console.error('Failed to rename chapter:', e);
      ctx.addLog(`Error renaming chapter: ${e}`, 'error');
    }
  };

  const compareIds = (id1: any, id2: any) => {
    if (!id1 && !id2) return true;
    if (!id1 || !id2) return false;
    return String(id1.id || id1).split(':').pop() === String(id2.id || id2).split(':').pop();
  };

  const closeEditorsFor = (predicate: (e: any) => boolean) => {
    for (const ed of ctx.openEditors.value.filter(predicate)) {
      ctx.closeEditor(ed.id, true);
      if (ctx.tabs.activeTreeNode.value && ctx.tabs.activeTreeNode.value.type === 'chapter' && ctx.tabs.activeTreeNode.value.node.id === ed.id) {
        ctx.tabs.activeTreeNode.value = null;
      }
    }
  };

  const deleteVolume = async (volume: any, chaptersInVol: any[] = [], arcsInVol: any[] = [], silent: boolean = false) => {
    if (!silent && !confirm(`Удалить том "${volume.title}" и все его содержимое?`)) return;
    try {
      const { apiService } = await import('../services/api.service');
      // Закрываем все открытые вкладки глав, относящихся к этому тому/аркам
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.volumeId, volume.id) ||
          arcsInVol.some(arcId => compareIds(e.data.arcId, arcId)) ||
          chaptersInVol.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInVol) {
        try { await apiService.deleteChapter(ctx.projectName, ch.id); } catch (err) { console.error('Ошибка удаления главы (vol):', err); }
        ctx.closeEditor(String(ch.id), true);
        if (ctx.tabs.activeTreeNode.value && ctx.tabs.activeTreeNode.value.type === 'chapter' && ctx.tabs.activeTreeNode.value.node.id === ch.id) {
          ctx.tabs.activeTreeNode.value = null;
        }
      }
      for (const arcId of arcsInVol) {
        await apiService.deleteArc(ctx.projectName, arcId);
        if (ctx.tabs.activeTreeNode.value && ctx.tabs.activeTreeNode.value.type === 'arc' && ctx.tabs.activeTreeNode.value.node.id === arcId) {
          ctx.tabs.activeTreeNode.value = null;
        }
      }
      await apiService.deleteVolume(ctx.projectName, volume.id);
      ctx.addLog(`Deleted volume [${volume.id}]`, 'warn');
      if (ctx.tabs.activeTreeNode.value && ctx.tabs.activeTreeNode.value.type === 'volume' && ctx.tabs.activeTreeNode.value.node.id === volume.id) {
        ctx.tabs.activeTreeNode.value = null;
      }
      if (ctx.chapterTreeRef?.value?.load) ctx.chapterTreeRef.value.load();
      ctx.addToast(`Том "${volume.title}" удален`, 'warn');
      if (ctx.lists.currentSidebarTab.value === 'chapters') ctx.lists.loadEntityList('chapters');
    } catch (e) {
      ctx.addLog(`Error deleting volume: ${e}`, 'error');
    }
  };

  const deleteArc = async (arc: any, chaptersInArc: any[] = [], silent: boolean = false) => {
    if (!silent && !confirm(`Удалить арку "${arc.title}" и все ее главы?`)) return;
    try {
      const { apiService } = await import('../services/api.service');
      closeEditorsFor(e =>
        e.tabType === 'chapter' && (
          compareIds(e.data.arcId, arc.id) ||
          chaptersInArc.some(c => String(c.id) === e.id)
        )
      );
      for (const ch of chaptersInArc) {
        try { await apiService.deleteChapter(ctx.projectName, ch.id); } catch (err) { console.error('Ошибка удаления главы (arc):', err); }
        ctx.closeEditor(String(ch.id), true);
        if (ctx.tabs.activeTreeNode.value && ctx.tabs.activeTreeNode.value.type === 'chapter' && ctx.tabs.activeTreeNode.value.node.id === ch.id) {
          ctx.tabs.activeTreeNode.value = null;
        }
      }
      await apiService.deleteArc(ctx.projectName, arc.id);
      ctx.addLog(`Deleted arc [${arc.id}]`, 'warn');
      if (ctx.tabs.activeTreeNode.value && ctx.tabs.activeTreeNode.value.type === 'arc' && ctx.tabs.activeTreeNode.value.node.id === arc.id) {
        ctx.tabs.activeTreeNode.value = null;
      }
      if (ctx.chapterTreeRef?.value?.load) ctx.chapterTreeRef.value.load();
      ctx.addToast(`Арка "${arc.title}" удалена`, 'warn');
      if (ctx.lists.currentSidebarTab.value === 'chapters') ctx.lists.loadEntityList('chapters');
    } catch (e) {
      ctx.addLog(`Error deleting arc: ${e}`, 'error');
    }
  };

  return {
    createChapterIn,
    deleteChapter,
    renameChapter,
    deleteVolume,
    deleteArc,
  };
}