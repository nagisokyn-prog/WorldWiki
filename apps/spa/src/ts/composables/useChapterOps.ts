import { triggerRef } from 'vue';
import { apiService } from '../services/api.service';

export interface UseChapterOpsProps {
  projectName: string;
  addLog: (msg: string, type: string) => void;
  addToast: (msg: string, type: string) => void;
  chapterTreeRef: any;
  chapters: any;
  openChapterTab: (chapter: any) => void;
  closeEditor: (id: string, force?: boolean) => void;
  activeTreeNode: any;
  openEditors: any;
  eg: any; // Editor groups
}

export function useChapterOps({
  projectName,
  addLog,
  addToast,
  chapterTreeRef,
  chapters,
  openChapterTab,
  closeEditor,
  activeTreeNode,
  openEditors,
  eg
}: UseChapterOpsProps) {
  let isCreatingChapter = false;

  const createChapterIn = async ({ arcId, volumeId }: { arcId?: string; volumeId?: string }) => {
    if (isCreatingChapter) return;
    isCreatingChapter = true;
    try {
      const hierarchy = await apiService.getHierarchy(projectName);
      const allChapters = hierarchy.chapters || [];
      
      let maxNum = 0;
      let relevantCount = 0;
      
      if (allChapters && Array.isArray(allChapters)) {
        const relevantChapters = allChapters.filter(c => {
          const cArcId = c.arcId ? String(c.arcId) : null;
          const cVolId = c.volumeId ? String(c.volumeId) : null;
          const targetArcId = arcId ? String(arcId) : null;
          const targetVolId = volumeId ? String(volumeId) : null;

          if (targetArcId) return cArcId === targetArcId;
          if (targetVolId) return cVolId === targetVolId && !cArcId;
          return !cArcId && !cVolId;
        });

        relevantCount = relevantChapters.length;
        relevantChapters.forEach(c => {
          const m = (c.title || "").match(/Глава\s*(\d+)/i);
          if (m) {
            const n = parseInt(m[1]);
            if (n > maxNum) maxNum = n;
          }
        });
      }
      
      const num = maxNum + 1;
      addLog(`Manuscript -> Next chapter number: ${num} (found ${relevantCount} in this section)`, 'info');
      const newCh = {
        id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: `Глава ${num}`,
        content: '# Новая глава\n\n',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordCount: 0,
        footnotes: {},
        timelineEvents: [],
        participants: [],
        arcId,
        volumeId
      };

      const saveRes = await apiService.saveChapter(projectName, newCh);
      if (saveRes && (saveRes as any).id) {
        newCh.id = (saveRes as any).id;
      }
      
      if (arcId || volumeId) {
        await apiService.assignChapter(projectName, newCh.id, arcId, volumeId);
      }

      addLog(`Manuscript -> Created new chapter`, 'success');
      await chapterTreeRef.value?.load(newCh.id);
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      
      if (chapters.value) {
        chapters.value.push(newCh);
        triggerRef(chapters);
      }

      openChapterTab(newCh);
    } catch (e) {
      addLog(`Manuscript -> Error creating chapter: ${e}`, 'error');
    } finally {
      isCreatingChapter = false;
    }
  };

  const deleteChapter = async (chapter: any, silent = false) => {
    if (!silent && !confirm(`Удалить главу "${chapter.title}"?`)) return;
    try {
      await apiService.deleteChapter(projectName, chapter.id);
      addLog(`Manuscript -> Deleted chapter [${chapter.id}]`, 'warn');
      closeEditor(chapter.id, true);
      if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === chapter.id) {
        activeTreeNode.value = null;
      }
      await chapterTreeRef.value?.load();
      addToast(`Глава "${chapter.title}" удалена`, 'warn');
    } catch (e) {
      addLog(`Manuscript -> Error deleting chapter: ${e}`, 'error');
    }
  };

  const renameChapter = async (chapter: any, newTitle: string) => {
    try {
      eg.updateTabData(chapter.id, { title: newTitle });
      const fullData = await apiService.getChapter(projectName, chapter.id);
      fullData.title = newTitle;
      await apiService.saveChapter(projectName, fullData);
      addLog(`Chapter renamed: ${newTitle}`, 'success');
    } catch (e) {
      console.error('Failed to rename chapter:', e);
      addLog(`Error renaming chapter: ${e}`, 'error');
    }
  };

  const deleteVolume = async (volume: any, chaptersInVol: any[] = [], arcsInVol: any[] = [], silent: boolean = false) => {
    if (!silent && !confirm(`Удалить том "${volume.title}" и все его содержимое?`)) return;
    try {
      const compareIds = (id1: any, id2: any) => {
        if (!id1 && !id2) return true;
        if (!id1 || !id2) return false;
        return String(id1.id || id1).split(':').pop() === String(id2.id || id2).split(':').pop();
      };

      const editorsToClose = openEditors.value.filter((e: any) => 
        e.tabType === 'chapter' && 
        (
          compareIds(e.data.volumeId, volume.id) || 
          arcsInVol.some(arcId => compareIds(e.data.arcId, arcId)) ||
          chaptersInVol.some(c => String(c.id) === e.id)
        )
      );
      for (const ed of editorsToClose) {
        closeEditor(ed.id, true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ed.id) {
          activeTreeNode.value = null;
        }
      }

      for (const ch of chaptersInVol) {
        try {
          await apiService.deleteChapter(projectName, ch.id);
        } catch (err) {}
        closeEditor(String(ch.id), true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
          activeTreeNode.value = null;
        }
      }
      for (const arcId of arcsInVol) {
        await apiService.deleteArc(projectName, arcId);
        if (activeTreeNode.value && activeTreeNode.value.type === 'arc' && activeTreeNode.value.node.id === arcId) {
          activeTreeNode.value = null;
        }
      }

      await apiService.deleteVolume(projectName, volume.id);
      addLog(`Deleted volume [${volume.id}]`, 'warn');
      
      if (activeTreeNode.value && activeTreeNode.value.type === 'volume' && activeTreeNode.value.node.id === volume.id) {
        activeTreeNode.value = null;
      }

      await chapterTreeRef.value?.load();
      addToast(`Том "${volume.title}" удален`, 'warn');
    } catch (e) {
      addLog(`Error deleting volume: ${e}`, 'error');
    }
  };

  const deleteArc = async (arc: any, chaptersInArc: any[] = [], silent: boolean = false) => {
    if (!silent && !confirm(`Удалить арку "${arc.title}" и все ее главы?`)) return;
    try {
      const compareIds = (id1: any, id2: any) => {
        if (!id1 && !id2) return true;
        if (!id1 || !id2) return false;
        return String(id1.id || id1).split(':').pop() === String(id2.id || id2).split(':').pop();
      };

      const editorsToClose = openEditors.value.filter((e: any) => 
        e.tabType === 'chapter' && 
        (compareIds(e.data.arcId, arc.id) || chaptersInArc.some(c => String(c.id) === e.id))
      );
      for (const ed of editorsToClose) {
        closeEditor(ed.id, true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ed.id) {
          activeTreeNode.value = null;
        }
      }

      for (const ch of chaptersInArc) {
        try {
          await apiService.deleteChapter(projectName, ch.id);
        } catch (err) {}
        closeEditor(String(ch.id), true);
        if (activeTreeNode.value && activeTreeNode.value.type === 'chapter' && activeTreeNode.value.node.id === ch.id) {
          activeTreeNode.value = null;
        }
      }

      await apiService.deleteArc(projectName, arc.id);
      addLog(`Deleted arc [${arc.id}]`, 'warn');
      
      if (activeTreeNode.value && activeTreeNode.value.type === 'arc' && activeTreeNode.value.node.id === arc.id) {
        activeTreeNode.value = null;
      }

      await chapterTreeRef.value?.load();
      addToast(`Арка "${arc.title}" удалена`, 'warn');
    } catch (e) {
      addLog(`Error deleting arc: ${e}`, 'error');
    }
  };

  return {
    createChapterIn,
    deleteChapter,
    renameChapter,
    deleteVolume,
    deleteArc
  };
}
