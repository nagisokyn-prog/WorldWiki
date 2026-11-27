import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { usePromiseFiltering, cleanId } from './usePromiseFiltering';

describe('usePromiseFiltering', () => {
  it('cleans string, object, and empty IDs', () => {
    expect(cleanId(null)).toBe('');
    expect(cleanId('chapters:ch_1')).toBe('ch_1');
    expect(cleanId({ id: 'chapters:"ch_2"' })).toBe('ch_2');
    expect(cleanId({ foo: 'bar' })).toContain('bar');
  });

  it('filters by scope, category, status, and builds parent-child tree', () => {
    const promises = ref([
      { id: 'p:1', chapter_id: 'ch:1', status: 'planted', kind: 'gun', quote: 'Q1' },
      { id: 'p:2', chapter_id: 'ch:1', status: 'developed', kind: 'scene', parent_id: 'p:1', quote: 'Q2' },
      { id: 'p:3', chapter_id: 'ch:2', status: 'resolved', kind: 'conflict', quote: 'Q3' },
    ]);

    const hook = usePromiseFiltering({
      promises,
      chapterId: () => 'chapters:ch:1',
      chapterTitle: () => 'Глава Первая',
      allChapters: () => [{ id: 'ch:2', title: 'Глава Вторая' }],
    });

    expect(hook.chapterPromises.value).toHaveLength(2);
    expect(hook.filteredPromises.value).toHaveLength(2);
    expect(hook.filteredPromises.value[0].children).toHaveLength(1);

    hook.scopeFilter.value = 'current';
    expect(hook.filteredPromises.value).toHaveLength(1);

    hook.categoryFilter.value = 'scenes';
    expect(hook.filteredPromises.value).toHaveLength(1);

    hook.categoryFilter.value = 'promises';
    expect(hook.filteredPromises.value).toHaveLength(1);

    hook.categoryFilter.value = 'all';
    hook.statusFilter.value = 'developed';
    expect(hook.filteredPromises.value).toHaveLength(1);

    expect(hook.getChapterTitle('')).toBe('Глава');
    expect(hook.getChapterTitle('ch:1')).toBe('Глава Первая');
    expect(hook.getChapterTitle('ch:2')).toBe('Глава Вторая');
    expect(hook.getChapterTitle('ch:99')).toBe('Глава 99');

    expect(hook.getKindInfo('gun').icon).toBe('🔫');
    expect(hook.getKindInfo('custom').label).toBe('custom');
    expect(hook.getKindInfo('').label).toBe('Обещание');
  });

  it('handles missing chapterId option', () => {
    const promises = ref([{ id: 'p:1', chapter_id: 'ch:1', status: 'planted', kind: 'gun' }]);
    const hook = usePromiseFiltering({ promises });
    expect(hook.chapterPromises.value).toEqual([]);
    expect(hook.isCurrentChapterPromise('ch:1')).toBe(false);
  });

  it('filters by searchQuery across quote, location, milestones and keeps parent for matched subscene', () => {
    const promises = ref([
      { id: 's1', chapter_id: 'ch:1', status: 'planted', kind: 'scene', quote: 'Штурм ворот', location_id: 'Крепость' },
      { id: 's2', chapter_id: 'ch:1', status: 'planted', kind: 'scene', parent_id: 's1', quote: 'Тайный ход' },
      { id: 'g1', chapter_id: 'ch:1', status: 'developed', kind: 'gun', quote: 'Старый ключ', milestones: [{ quote: 'Открыли сундук' }] }
    ] as any[]);
    const hook = usePromiseFiltering({ promises });

    hook.searchQuery.value = 'крепость';
    expect(hook.filteredPromises.value.map((p) => p.id)).toEqual(['s1']);

    hook.searchQuery.value = 'тайный ход';
    expect(hook.filteredPromises.value).toHaveLength(1);
    expect(hook.filteredPromises.value[0].id).toBe('s2');

    hook.searchQuery.value = 'сундук';
    expect(hook.filteredPromises.value.map((p) => p.id)).toEqual(['g1']);
  });

  it('sorts cards by first paragraph position in chapter content and puts scene before nested item at same block', () => {
    const promises = ref([
      { id: 'm1', chapter_id: 'ch:1', status: 'planted', kind: 'mystery', block_ids: ['blk_2'], paragraph_index: 5 },
      { id: 's1', chapter_id: 'ch:1', status: 'planted', kind: 'scene', block_ids: ['blk_1', 'blk_2'], paragraph_index: 10 },
      { id: 'g1', chapter_id: 'ch:1', status: 'planted', kind: 'gun', block_ids: ['blk_1'], paragraph_index: 10 }
    ] as any[]);
    const hook = usePromiseFiltering({
      promises,
      chapterId: 'ch:1',
      currentChapterContent: '<p data-block-id="blk_1">Первый</p><p data-block-id="blk_2">Второй</p>'
    });
    expect(hook.filteredPromises.value.map((p) => p.id)).toEqual(['s1', 'g1', 'm1']);
  });
});
