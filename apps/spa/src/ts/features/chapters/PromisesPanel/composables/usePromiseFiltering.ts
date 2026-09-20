import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { PlotPromise } from '@/types/generated/PlotPromise';

export interface ChapterMetaItem {
  id: string | null;
  title: string;
  [key: string]: unknown;
}

export const PROMISE_KINDS: Record<string, { label: string; icon: string }> = {
  gun: { label: 'Чеховское ружьё', icon: '🔫' },
  foreshadowing: { label: 'Предзнаменование', icon: '🔮' },
  mystery: { label: 'Тайна', icon: '🗝️' },
  question: { label: 'Нераскрытый вопрос', icon: '❓' }
};

export const PROMISE_STATUSES: Array<{ id: string; label: string; icon: string }> = [
  { id: 'planted', label: 'Посажено', icon: '🌱' },
  { id: 'developed', label: 'Развито', icon: '🌿' },
  { id: 'resolved', label: 'Отстреляно', icon: '🎯' }
];

export function cleanId(id: unknown): string {
  if (!id) return '';
  const s = typeof id === 'string' ? id : ((id as { id?: { String?: string } | string }).id || JSON.stringify(id));
  const parts = String(s).split(':');
  return (parts[parts.length - 1] || String(s)).replace(/["'`]/g, '').trim();
}

export interface UsePromiseFilteringOptions {
  promises: Ref<PlotPromise[]>;
  chapterId?: string | null;
  chapterTitle?: string | null;
  allChapters?: ChapterMetaItem[];
}

export function usePromiseFiltering(options: UsePromiseFilteringOptions) {
  const scopeFilter = ref<'all' | 'current'>('all');
  const statusFilter = ref<'all' | 'planted' | 'developed' | 'resolved'>('all');

  const isCurrentChapterPromise = (promiseChapterId: string) => {
    if (!options.chapterId) return false;
    return cleanId(options.chapterId) === cleanId(promiseChapterId);
  };

  const chapterPromises = computed(() => {
    if (!options.chapterId) return [];
    return options.promises.value.filter((p) => isCurrentChapterPromise(p.chapter_id));
  });

  const filteredPromises = computed(() => {
    let list = options.promises.value;

    if (scopeFilter.value === 'current') {
      list = chapterPromises.value;
    }

    if (statusFilter.value !== 'all') {
      list = list.filter((p) => p.status === statusFilter.value);
    }

    return list;
  });

  const getChapterTitle = (chapterId: string) => {
    if (!chapterId) return 'Глава';
    if (options.chapterId && isCurrentChapterPromise(chapterId) && options.chapterTitle) {
      return options.chapterTitle;
    }
    const targetClean = cleanId(chapterId);
    const found = options.allChapters?.find((c) => {
      return cleanId(c.id) === targetClean;
    });
    return found?.title || `Глава ${targetClean}`;
  };

  const getKindInfo = (kind: string) => {
    return PROMISE_KINDS[kind] || { label: 'Обещание', icon: '📌' };
  };

  return {
    scopeFilter,
    statusFilter,
    isCurrentChapterPromise,
    chapterPromises,
    filteredPromises,
    getChapterTitle,
    getKindInfo
  };
}
