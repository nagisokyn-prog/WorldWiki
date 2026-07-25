import { ref, shallowRef, computed, type Ref } from 'vue';
import { apiService } from '../../../../services/api.service';

export function useChapterHistory(project: string, currentChapterId: Ref<string | undefined>, currentChapter: Ref<any>) {
  const showHistory = ref(false);
  const isLoadingHistory = ref(false);
  const revisions = shallowRef<any[]>([]);
  const previewingRevId = ref<string | null>(null);
  const maxSaves = ref(20);

  const originalData = ref<{ content: any; title: string; footnotes: any } | null>(null);

  const toggleHistory = () => {
    showHistory.value = !showHistory.value;
    if (showHistory.value && currentChapterId.value) {
      loadHistory();
    }
  };

  const loadHistory = async () => {
    if (!currentChapterId.value) return;
    try {
      isLoadingHistory.value = true;
      const history = await apiService.getChapterRevisions(project, currentChapterId.value) || [];
      revisions.value = history.map((rev: any) => ({
        ...rev,
        formattedDate: new Date(rev.created_at).toLocaleString()
      }));
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      isLoadingHistory.value = false;
    }
  };

  const previewHistory = (rev: any) => {
    if (!currentChapter.value) return;
    if (previewingRevId.value === rev.id) {
      if (originalData.value) {
        currentChapter.value.content = originalData.value.content;
        currentChapter.value.title = originalData.value.title;
        currentChapter.value.footnotes = originalData.value.footnotes;
        originalData.value = null;
      }
      previewingRevId.value = null;
      return;
    }

    if (!originalData.value) {
      originalData.value = {
        content: currentChapter.value.content,
        title: currentChapter.value.title,
        footnotes: JSON.parse(JSON.stringify(currentChapter.value.footnotes || {}))
      };
    }

    const snap = rev.content;
    currentChapter.value.content = snap.content || snap.attributes?.content || '';
    currentChapter.value.title = snap.title || snap.attributes?.title || '';
    currentChapter.value.footnotes = snap.footnotes || snap.attributes?.footnotes || {};
    previewingRevId.value = rev.id;
  };

  const togglePin = async (rev: any) => {
    try {
      rev.is_pinned = !rev.is_pinned;
      await apiService.toggleChapterHistoryPin(rev.id, rev.is_pinned);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      rev.is_pinned = !rev.is_pinned;
    }
  };

  const getDiffSummary = (current: any, previous: any) => {
    if (!previous) return 'Первая версия';
    const currSnap = current.content.attributes || current.content;
    const prevSnap = previous.content.attributes || previous.content;

    const changes = [];
    if (currSnap.title !== prevSnap.title) changes.push('Название');
    if (currSnap.content !== prevSnap.content) changes.push('Текст');
    if (JSON.stringify(currSnap.footnotes) !== JSON.stringify(prevSnap.footnotes)) changes.push('Сноски');

    if (changes.length > 0) {
      return `<span style="color:var(--accent)">Изменено:</span> ${changes.join(', ')}`;
    }
    return 'Нет визуальных изменений';
  };

  const changedFields = computed(() => {
    if (!previewingRevId.value || !originalData.value) return [];

    const currentSnap = revisions.value.find(r => r.id === previewingRevId.value);
    if (!currentSnap) return [];

    const snapData = currentSnap.content.attributes || currentSnap.content;
    const original = originalData.value;

    const changes = [];
    if (snapData.title !== original.title) changes.push('title');
    if (snapData.content !== original.content) changes.push('content');
    if (JSON.stringify(snapData.footnotes) !== JSON.stringify(original.footnotes)) changes.push('footnotes');

    return changes;
  });

  return {
    showHistory, isLoadingHistory, revisions, previewingRevId, maxSaves, originalData,
    toggleHistory, loadHistory, previewHistory, togglePin, getDiffSummary, changedFields
  };
}
