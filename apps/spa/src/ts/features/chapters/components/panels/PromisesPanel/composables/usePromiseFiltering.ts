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
  currentChapterContent?: MaybeRefOrGetter<string | null | undefined>;
}

export function usePromiseFiltering<T extends { chapter_id?: string | null; status: string; quote?: string | null; kind?: string; id?: string | null; parent_id?: string | null; children?: T[] } = PlotPromise>(options: UsePromiseFilteringOptions<T>) {
  const scopeFilter = ref<'all' | 'current'>('all');
  const statusFilter = ref<'all' | 'planted' | 'developed' | 'resolved'>('all');
  const categoryFilter = ref<'all' | 'scenes' | 'promises'>('all');
  const searchQuery = ref('');
  const collapsedChapterIds = ref<Set<string>>(new Set());

  const getCurrentChapterId = () => toValue(options.chapterId);
  const getCurrentChapterTitle = () => toValue(options.chapterTitle);
  const getAllChapters = () => toValue(options.allChapters) || [];

  const currentChapterBlockOrder = computed(() => {
    const map = new Map<string, number>();
    const html = toValue(options.currentChapterContent);
    if (!html || typeof html !== 'string' || typeof DOMParser === 'undefined') return map;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocks = doc.body.querySelectorAll(':scope > p, :scope > blockquote, :scope > h1, :scope > h2, :scope > h3, :scope > div');
    blocks.forEach((el, idx) => {
      const bId = el.getAttribute('data-block-id') || el.getAttribute('data-id');
      if (bId) map.set(bId.trim().toLowerCase(), idx + 1);
    });
    return map;
  });

  const getFirstParagraphOrder = (item: T): number => {
    const rec = item as unknown as {
      chapter_id?: string | null;
      block_id?: string | null;
      block_ids?: string[];
      paragraph_index?: number | null;
      milestones?: Array<{ order_index?: number | null }>;
    };
    const currentId = cleanId(getCurrentChapterId());
    const itemChap = cleanId(rec.chapter_id);
    if (currentId && itemChap === currentId && currentChapterBlockOrder.value.size > 0) {
      const firstId = (rec.block_ids?.[0] || rec.block_id || '').trim().toLowerCase();
      if (firstId && currentChapterBlockOrder.value.has(firstId)) {
        return currentChapterBlockOrder.value.get(firstId)!;
      }
    }
    return rec.paragraph_index ?? rec.milestones?.[0]?.order_index ?? 999999;
  };

  const sortByFirstParagraph = (items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const diff = getFirstParagraphOrder(a) - getFirstParagraphOrder(b);
      if (diff !== 0) return diff;
      if (a.kind === 'scene' && b.kind !== 'scene') return -1;
      if (b.kind === 'scene' && a.kind !== 'scene') return 1;
      return 0;
    });
  };

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

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
      const matchesQuery = (item: T) => {
        const rec = item as unknown as {
          title?: string | null;
          quote?: string | null;
          note?: string | null;
          location_id?: string | null;
          milestones?: Array<{ quote?: string | null; note?: string | null; location_id?: string | null }>;
        };
        if (
          (rec.title && rec.title.toLowerCase().includes(q)) ||
          (rec.quote && rec.quote.toLowerCase().includes(q)) ||
          (rec.note && rec.note.toLowerCase().includes(q)) ||
          (rec.location_id && rec.location_id.toLowerCase().includes(q))
        ) {
          return true;
        }
        return Array.isArray(rec.milestones) && rec.milestones.some((m) =>
          (m.quote && m.quote.toLowerCase().includes(q)) ||
          (m.note && m.note.toLowerCase().includes(q)) ||
          (m.location_id && m.location_id.toLowerCase().includes(q))
        );
      };
      list = list.filter(matchesQuery);
    }

    const itemMap = new Map<string, T>();
    const roots: T[] = [];

    for (const p of list) {
      const cId = cleanId(p.id);
      itemMap.set(cId, { ...p, children: [] });
    }

    if (q) {
      // При поиске показываем все совпавшие элементы (включая вложенные подсцены) отдельными карточками
      return Array.from(itemMap.values());
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

    return sortByFirstParagraph(roots);
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

  const groupedByChapter = computed(() => {
    const groups = new Map<string, { chapterId: string; title: string; isCurrent: boolean; isCollapsed: boolean; items: T[] }>();
    const currentId = cleanId(getCurrentChapterId());
    const chapterOrder = new Map<string, number>();
    getAllChapters().forEach((c, idx) => chapterOrder.set(cleanId(c.id), idx));

    for (const item of filteredPromises.value) {
      const cId = cleanId(item.chapter_id) || '__unknown__';
      let grp = groups.get(cId);
      if (!grp) {
        grp = {
          chapterId: cId,
          title: cId === '__unknown__' ? 'Без главы' : getChapterTitle(item.chapter_id || ''),
          isCurrent: Boolean(currentId && cId === currentId),
          isCollapsed: collapsedChapterIds.value.has(cId),
          items: []
        };
        groups.set(cId, grp);
      }
      grp.items.push(item);
    }

    return Array.from(groups.values())
      .map((g) => ({ ...g, items: sortByFirstParagraph(g.items) }))
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        const ordA = chapterOrder.get(a.chapterId) ?? 9999;
        const ordB = chapterOrder.get(b.chapterId) ?? 9999;
        return ordA - ordB;
      });
  });

  const displayGroups = computed(() => {
    const showFolders = scopeFilter.value === 'all' && !searchQuery.value.trim() && groupedByChapter.value.length > 1;
    if (showFolders) {
      return groupedByChapter.value.map((g) => ({ ...g, showHeader: true }));
    }
    return [{
      chapterId: '__flat__',
      title: '',
      isCurrent: false,
      isCollapsed: false,
      showHeader: false,
      items: filteredPromises.value
    }];
  });

  const toggleChapterGroup = (chapterId: string) => {
    const next = new Set(collapsedChapterIds.value);
    if (next.has(chapterId)) next.delete(chapterId);
    else next.add(chapterId);
    collapsedChapterIds.value = next;
  };

  return {
    scopeFilter,
    statusFilter,
    categoryFilter,
    searchQuery,
    isCurrentChapterPromise,
    chapterPromises,
    filteredPromises,
    groupedByChapter,
    displayGroups,
    toggleChapterGroup,
    getChapterTitle,
    getKindInfo
  };
}
