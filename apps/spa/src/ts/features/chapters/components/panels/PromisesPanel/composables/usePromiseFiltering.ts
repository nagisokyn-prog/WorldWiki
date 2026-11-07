import { ref, computed, toValue } from 'vue';
import type { Ref, MaybeRefOrGetter } from 'vue';
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
  question: { label: 'Нераскрытый вопрос', icon: '❓' },
  scene: { label: 'Сцена / Эпизод', icon: '🎬' },
  conflict: { label: 'Конфликт / Столкновение', icon: '⚔️' }
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

export interface UsePromiseFilteringOptions<T extends { chapter_id?: string | null; status: string; quote?: string | null; id?: string | null; parent_id?: string | null; children?: T[] } = PlotPromise> {
  promises: Ref<T[]>;
  chapterId?: MaybeRefOrGetter<string | null | undefined>;
  chapterTitle?: MaybeRefOrGetter<string | null | undefined>;
  allChapters?: MaybeRefOrGetter<ChapterMetaItem[] | undefined>;
}

export function usePromiseFiltering<T extends { chapter_id?: string | null; status: string; quote?: string | null; kind?: string; id?: string | null; parent_id?: string | null; children?: T[] } = PlotPromise>(options: UsePromiseFilteringOptions<T>) {
  const scopeFilter = ref<'all' | 'current'>('all');
  const statusFilter = ref<'all' | 'planted' | 'developed' | 'resolved'>('all');
  const categoryFilter = ref<'all' | 'scenes' | 'promises'>('all');

  const getCurrentChapterId = () => toValue(options.chapterId);
  const getCurrentChapterTitle = () => toValue(options.chapterTitle);
  const getAllChapters = () => toValue(options.allChapters) || [];

  const isCurrentChapterPromise = (promiseChapterId: string) => {
    const currentId = getCurrentChapterId();
    if (!currentId) return false;
    return cleanId(currentId) === cleanId(promiseChapterId);
  };

  const chapterPromises = computed(() => {
    const currentId = getCurrentChapterId();
    if (!currentId) return [];
    return options.promises.value.filter((p) => isCurrentChapterPromise(p.chapter_id || ''));
  });

  const filteredPromises = computed(() => {
    let list = options.promises.value;

    if (scopeFilter.value === 'current') {
      list = chapterPromises.value;
    }

    if (categoryFilter.value === 'scenes') {
      list = list.filter((p) => p.kind === 'scene' || p.kind === 'conflict');
    } else if (categoryFilter.value === 'promises') {
      list = list.filter((p) => p.kind !== 'scene' && p.kind !== 'conflict');
    }

    if (statusFilter.value !== 'all') {
      list = list.filter((p) => p.status === statusFilter.value);
    }

    const itemMap = new Map<string, T>();
    const roots: T[] = [];

    for (const p of list) {
      const cId = cleanId(p.id);
      itemMap.set(cId, { ...p, children: [] });
    }

    for (const p of list) {
      const cId = cleanId(p.id);
      const current = itemMap.get(cId);
      if (!current) continue;

      const pParentId = p.parent_id ? cleanId(p.parent_id) : null;
      if (pParentId && itemMap.has(pParentId)) {
        const parent = itemMap.get(pParentId)!;
        parent.children = parent.children || [];
        parent.children.push(current);
      } else {
        roots.push(current);
      }
    }

    return roots;
  });

  const getChapterTitle = (chapterId: string) => {
    if (!chapterId) return 'Глава';
    const currentId = getCurrentChapterId();
    const currentTitle = getCurrentChapterTitle();
    if (currentId && isCurrentChapterPromise(chapterId) && currentTitle) {
      return currentTitle;
    }
    const targetClean = cleanId(chapterId);
    const found = getAllChapters().find((c) => {
      return cleanId(c.id) === targetClean;
    });
    return found?.title || `Глава ${targetClean}`;
  };

  const getKindInfo = (kind: string) => {
    return PROMISE_KINDS[kind] || { label: kind || 'Обещание', icon: '📌' };
  };

  return {
    scopeFilter,
    statusFilter,
    categoryFilter,
    isCurrentChapterPromise,
    chapterPromises,
    filteredPromises,
    getChapterTitle,
    getKindInfo
  };
}
