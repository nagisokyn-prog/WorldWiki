import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChekhovGunTracker } from './useChekhovGunTracker';
import * as apiClient from '@/services/api.client';
import type { ItemTrackerReport } from './ChekhovGunTracker.model';

vi.mock('@/services/api.client', () => ({
  getItemTracker: vi.fn(),
  getItemJourney: vi.fn(),
  getCrossReferenceMatrix: vi.fn(),
  auditManuscriptConsistency: vi.fn(),
  getManuscriptStatistics: vi.fn(),
}));

describe('useChekhovGunTracker Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const sampleReport: ItemTrackerReport = {
    summary: {
      total_items: 3,
      active_count: 1,
      sleeping_count: 1,
      forgotten_count: 1,
      destroyed_count: 0,
    },
    items: [
      {
        id: 'entities:sword',
        name: 'Клинок Зари',
        item_type: 'оружие',
        status_category: 'Цел / Активен',
        current_owner_id: 'entities:char1',
        current_owner_name: 'Король Артур',
        first_chapter_order: 1,
        last_chapter_order: 10,
        skipped_chapters: 0,
        total_mentions: 6,
        usage_state: 'active',
        custody_chain: [],
      },
      {
        id: 'entities:ring',
        name: 'Кольцо Теней',
        item_type: 'артефакт',
        status_category: 'Цел / Активен',
        current_owner_id: null,
        current_owner_name: null,
        first_chapter_order: 2,
        last_chapter_order: 4,
        skipped_chapters: 6,
        total_mentions: 2,
        usage_state: 'sleeping',
        custody_chain: [],
      },
      {
        id: 'entities:scroll',
        name: 'Забытый Свиток',
        item_type: 'улика_документ',
        status_category: 'Цел / Активен',
        current_owner_id: null,
        current_owner_name: null,
        first_chapter_order: 1,
        last_chapter_order: 1,
        skipped_chapters: 12,
        total_mentions: 1,
        usage_state: 'forgotten',
        custody_chain: [],
      },
    ],
  };

  it('correctly loads and groups items into active, sleeping, and forgotten columns', async () => {
    vi.mocked(apiClient.getItemTracker).mockResolvedValueOnce(sampleReport);

    const { loadData, summary, activeItems, sleepingItems, forgottenItems, isLoading } =
      useChekhovGunTracker('test_proj');

    await loadData(true);

    expect(isLoading.value).toBe(false);
    expect(summary.value.total_items).toBe(3);
    expect(activeItems.value.length).toBe(1);
    expect(activeItems.value[0].name).toBe('Клинок Зари');
    expect(sleepingItems.value.length).toBe(1);
    expect(sleepingItems.value[0].name).toBe('Кольцо Теней');
    expect(forgottenItems.value.length).toBe(1);
    expect(forgottenItems.value[0].name).toBe('Забытый Свиток');
  });

  it('filters items by search query and resets filter', async () => {
    vi.mocked(apiClient.getItemTracker).mockResolvedValueOnce(sampleReport);

    const { loadData, filter, filteredItems, resetFilter } = useChekhovGunTracker('test_proj');

    await loadData(true);
    expect(filteredItems.value.length).toBe(3);

    filter.value.search = 'Артур';
    expect(filteredItems.value.length).toBe(1);
    expect(filteredItems.value[0].name).toBe('Клинок Зари');

    resetFilter();
    expect(filter.value.search).toBe('');
    expect(filteredItems.value.length).toBe(3);
  });
});
