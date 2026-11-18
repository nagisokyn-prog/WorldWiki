import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useArcCard } from './useArcCard';
import type { ArcCardProps } from './ArcCard.model';

describe('useArcCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes correctly', () => {
    const props = {
      arc: { id: 'arc1', name: 'Arc 1' },
      linkedBlocks: [],
    } as unknown as ArcCardProps;
    const hook = useArcCard(props);
    expect(hook).toBeDefined();
    expect(hook.phaseCounts.value).toEqual({
      setup: 0,
      escalation: 0,
      climax: 0,
      resolution: 0,
    });
  });

  it('computes phaseCounts, displayBlocks, chapter titles, statuses, and arc type labels', async () => {
    const { useChapterStore } = await import('@/stores/chapter.store');
    const chapterStore = useChapterStore();
    chapterStore.hierarchy = {
      volumes: [],
      chapters: [{ id: 'chapters:ch_1', title: 'Пролог' } as never],
    };

    const props = {
      arc: { id: 'story_arcs:arc_1', title: 'Arc 1' },
      linkedBlocks: [
        {
          id: 'b1',
          chapter_id: 'chapters:ch_1',
          status: 'planted',
          arcs: [{ arc_id: 'story_arcs:arc_1', arc_phase: 'setup' }],
        },
        { id: 'b2', chapter_id: 'chapters:ch_2', status: 'developed', arc_phase: 'escalation' },
        { id: 'b3', chapter_id: '', status: 'resolved', arc_phase: 'climax' },
        { id: 'b4', chapter_id: 'chapters:ch_3', status: 'abandoned', arc_phase: 'resolution' },
        { id: 'b5', chapter_id: 'chapters:ch_4', status: 'other', arc_phase: 'unknown' },
      ],
    } as unknown as ArcCardProps;

    const hook = useArcCard(props);
    expect(hook.phaseCounts.value).toEqual({ setup: 1, escalation: 1, climax: 1, resolution: 1 });
    expect(hook.displayBlocks.value[0].formattedChapter).toBe('Пролог');
    expect(hook.displayBlocks.value[1].formattedChapter).toBe('Гл. ch_2');
    expect(hook.displayBlocks.value[2].formattedChapter).toBe('Глава ?');
    expect(hook.displayBlocks.value[0].statusLabel).toBe('🌱 Заложено');
    expect(hook.displayBlocks.value[1].statusLabel).toBe('⚡ Развитие');
    expect(hook.displayBlocks.value[2].statusLabel).toBe('✅ Разрешено');
    expect(hook.displayBlocks.value[3].statusLabel).toBe('🛑 Отменено');
    expect(hook.displayBlocks.value[4].statusLabel).toBe('other');

    expect(hook.getArcTypeLabel('character')).toBe('Персонаж');
    expect(hook.getArcTypeLabel('event')).toBe('Событие');
    expect(hook.getArcTypeLabel('relationship')).toBe('Отношения');
    expect(hook.getArcTypeLabel('theme')).toBe('Тематика');
    expect(hook.getArcTypeLabel(undefined)).toBe('Арка');
  });
});

