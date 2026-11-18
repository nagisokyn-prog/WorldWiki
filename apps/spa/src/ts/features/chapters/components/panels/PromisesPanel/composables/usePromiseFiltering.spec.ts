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
});
