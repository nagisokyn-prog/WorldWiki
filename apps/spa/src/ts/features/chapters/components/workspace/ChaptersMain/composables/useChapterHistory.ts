import { ref, shallowRef, computed, type Ref } from 'vue';
import * as api from '@/services/api.client';
import type { ChapterWithHierarchy } from '@/stores/chapter.store';
import { computeInlineDiff } from '@/services/AstDiff/ast-diff.wasm-bridge';

export interface ChapterRevisionContent {
  content?: string;
  title?: string;
  footnotes?: Record<string, { id: string; text: string }>;
  attributes?: {
    content?: string;
    title?: string;
    footnotes?: Record<string, { id: string; text: string }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ChapterRevision {
  id: string;
  created_at: string;
  formattedDate?: string;
  is_pinned?: boolean;
  content: ChapterRevisionContent;
  [key: string]: unknown;
}

export function useChapterHistory(
  project: string,
  currentChapterId: Ref<string | undefined>,
  currentChapter: Ref<ChapterWithHierarchy | null>,
  onRestoreCallback?: () => Promise<void> | void
) {
  const showHistory = ref(false);
  const isLoadingHistory = ref(false);
  const revisions = shallowRef<ChapterRevision[]>([]);
  const previewingRevId = ref<string | null>(null);
  const maxSaves = ref(20);

  const originalData = ref<{ content: string; title: string; footnotes: ChapterWithHierarchy['footnotes'] } | null>(null);

  const closeHistory = () => {
    showHistory.value = false;
    if (previewingRevId.value) {
      if (originalData.value && currentChapter.value) {
        currentChapter.value.content = originalData.value.content;
        currentChapter.value.title = originalData.value.title;
        currentChapter.value.footnotes = originalData.value.footnotes;
      }
      originalData.value = null;
      previewingRevId.value = null;
    }
  };

  const toggleHistory = () => {
    if (showHistory.value) {
      closeHistory();
    } else {
      showHistory.value = true;
      if (currentChapterId.value) {
        loadHistory();
      }
    }
  };

  const loadHistory = async () => {
    if (!currentChapterId.value) return;
    try {
      isLoadingHistory.value = true;
      const history = await api.getChapterRevisions(project, currentChapterId.value) || [];
      revisions.value = (history as ChapterRevision[]).map((rev) => ({
        ...rev,
        formattedDate: new Date(rev.created_at).toLocaleString()
      }));
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      isLoadingHistory.value = false;
    }
  };

  const previewHistory = (rev: ChapterRevision) => {
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
        content: currentChapter.value.content || '',
        title: currentChapter.value.title || '',
        footnotes: JSON.parse(JSON.stringify(currentChapter.value.footnotes || {}))
      };
    }

    const snap = rev.content || {};
    currentChapter.value.content = snap.content || snap.attributes?.content || '';
    currentChapter.value.title = snap.title || snap.attributes?.title || '';
    currentChapter.value.footnotes = snap.footnotes || snap.attributes?.footnotes || {};
    previewingRevId.value = rev.id;
  };

  const restoreRevision = async (rev: ChapterRevision) => {
    if (!currentChapter.value) return;
    const snap = rev.content || {};
    currentChapter.value.content = snap.content || snap.attributes?.content || '';
    currentChapter.value.title = snap.title || snap.attributes?.title || '';
    currentChapter.value.footnotes = snap.footnotes || snap.attributes?.footnotes || {};
    originalData.value = null;
    previewingRevId.value = null;
    showHistory.value = false;
    if (onRestoreCallback) {
      await onRestoreCallback();
    } else {
      await api.saveChapter(currentChapter.value as unknown as Parameters<typeof api.saveChapter>[0]);
    }
    await loadHistory();
  };

  const togglePin = async (rev: ChapterRevision) => {
    try {
      rev.is_pinned = !rev.is_pinned;
      await api.toggleChapterHistoryPin(rev.id, rev.is_pinned);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      rev.is_pinned = !rev.is_pinned;
    }
  };

  const getDiffSummary = (current: ChapterRevision, previous: ChapterRevision | undefined) => {
    if (!previous) return 'Первая версия';
    const currSnap = current.content?.attributes || current.content || {};
    const prevSnap = previous.content?.attributes || previous.content || {};

    const changes: string[] = [];
    if (currSnap.title !== prevSnap.title) changes.push('Название');
    if (currSnap.content !== prevSnap.content) {
      if (typeof currSnap.content === 'string' && typeof prevSnap.content === 'string') {
        const inlineChanges = computeInlineDiff(prevSnap.content, currSnap.content);
        const ins = inlineChanges.reduce((acc, c) => acc + (c.insert_text ? c.insert_text.length : 0), 0);
        const del = inlineChanges.reduce((acc, c) => acc + (c.delete_count || 0), 0);
        changes.push(ins > 0 || del > 0 ? `Текст (+${ins}/-${del})` : 'Текст');
      } else {
        changes.push('Текст');
      }
    }
    if (JSON.stringify(currSnap.footnotes) !== JSON.stringify(prevSnap.footnotes)) changes.push('Сноски');

    if (changes.length > 0) {
      return `<span class="text-accent">Изменено:</span> ${changes.join(', ')}`;
    }
    return 'Нет визуальных изменений';
  };

  const changedFields = computed<string[]>(() => {
    if (!previewingRevId.value || !originalData.value) return [];

    const currentSnap = revisions.value.find(r => r.id === previewingRevId.value);
    if (!currentSnap) return [];

    const snapData = currentSnap.content?.attributes || currentSnap.content || {};
    const original = originalData.value;

    const changed: string[] = [];
    if (snapData.title !== original.title) changed.push('title');
    if (snapData.content !== original.content) changed.push('content');
    if (JSON.stringify(snapData.footnotes) !== JSON.stringify(original.footnotes)) changed.push('footnotes');

    return changed;
  });

  return {
    showHistory,
    isLoadingHistory,
    revisions,
    previewingRevId,
    maxSaves,
    toggleHistory,
    closeHistory,
    loadHistory,
    previewHistory,
    restoreRevision,
    togglePin,
    getDiffSummary,
    changedFields
  };
}
