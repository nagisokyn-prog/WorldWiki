import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChekhovGunTracker, buildGunJourneyReport } from './useChekhovGunTracker';
import * as apiClient from '@/services/api.client';
import { plotApi } from '@/services/api/plot.api';
import type { ItemTrackerReport } from './ChekhovGunTracker.model';

vi.mock('@/services/api/plot.api', () => ({
  plotApi: {
    getPlotPromise: vi.fn(),
  },
}));

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
      total_items: 4,
      active_count: 2,
      sleeping_count: 1,
      forgotten_count: 1,
      destroyed_count: 0,
    },
    items: [
      {
        id: 'plot_promises:secret_letter',
        name: 'Тайна письма',
        item_type: 'Чеховское ружьё',
        status_category: 'Заряжено',
        current_owner_id: 'entities:char1',
        current_owner_name: 'Король Артур',
        first_chapter_order: 1,
        last_chapter_order: 3,
        skipped_chapters: 0,
        total_mentions: 3,
        usage_state: 'active',
        custody_chain: [],
      },
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

  it('correctly loads and separates narrative guns from physical artifact items', async () => {
    vi.mocked(apiClient.getItemTracker).mockResolvedValueOnce(sampleReport);

    const { loadData, filter, summary, gunsCount, itemsCount, totalCount, activeItems, setScope, isLoading } =
      useChekhovGunTracker('test_proj');

    await loadData(true);

    expect(isLoading.value).toBe(false);
    expect(gunsCount.value).toBe(1);
    expect(itemsCount.value).toBe(3);
    expect(totalCount.value).toBe(4);

    // Default scope: 'guns' -> only 1 narrative gun
    expect(filter.value.scope).toBe('guns');
    expect(summary.value.total_items).toBe(1);
    expect(activeItems.value.length).toBe(1);
    expect(activeItems.value[0].name).toBe('Тайна письма');

    // Switch to 'items' scope -> 3 physical artifacts
    setScope('items');
    expect(filter.value.scope).toBe('items');
    expect(summary.value.total_items).toBe(3);
    expect(activeItems.value.length).toBe(1);
    expect(activeItems.value[0].name).toBe('Клинок Зари');

    // Switch to 'all' scope -> 4 items total
    setScope('all');
    expect(filter.value.scope).toBe('all');
    expect(summary.value.total_items).toBe(4);
    expect(activeItems.value.length).toBe(2);
  });

  it('filters items by search query and resets filter without losing current scope', async () => {
    vi.mocked(apiClient.getItemTracker).mockResolvedValueOnce(sampleReport);

    const { loadData, filter, filteredItems, setScope, resetFilter } = useChekhovGunTracker('test_proj');

    await loadData(true);
    setScope('items');
    expect(filteredItems.value.length).toBe(3);

    filter.value.search = 'Артур';
    expect(filteredItems.value.length).toBe(1);
    expect(filteredItems.value[0].name).toBe('Клинок Зари');

    resetFilter();
    expect(filter.value.search).toBe('');
    expect(filter.value.scope).toBe('items');
    expect(filteredItems.value.length).toBe(3);
  });

  it('correctly builds gun journey report with milestones', () => {
    const gun = sampleReport.items[0];
    const mockPromise = {
      id: 'plot_promises:secret_letter',
      title: 'Тайна письма',
      kind: 'gun',
      status: 'resolved',
      note: 'Письмо вскрыто',
      chapter_id: 'chapters:ch1',
      paragraph_index: 3,
      block_id: 'b1',
      participant_ids: ['entities:char1'],
      arcs: [],
      arc_id: null,
      arc_phase: null,
      location_id: null,
      timeline_event_id: null,
      milestones: [
        {
          milestone_id: 'm1',
          stage: 'plant',
          quote: 'Лёха находит странный конверт под порогом.',
          note: null,
          block_id: 'b1',
          chapter_id: 'chapters:ch1',
          order_index: 1,
        },
        {
          milestone_id: 'm2',
          stage: 'resolution',
          quote: 'Письмо наконец прочитано перед всеми.',
          note: null,
          block_id: 'b2',
          chapter_id: 'chapters:ch3',
          order_index: 2,
        },
      ],
    };

    const chapters = [
      { id: 'chapters:ch1', title: 'Глава 1: Пролог', sort_order: 1 },
      { id: 'chapters:ch3', title: 'Глава 3: Развязка', sort_order: 3 },
    ];

    const report = buildGunJourneyReport(gun, mockPromise, chapters);

    expect(report.item_name).toBe('Тайна письма');
    expect(report.item_type).toBe('Чеховское ружьё');
    expect(report.nodes.length).toBe(2);

    expect(report.nodes[0].title).toBe('🌱 Завязка (Посадка ружья)');
    expect(report.nodes[0].node_type).toBe('creation');
    expect(report.nodes[0].description).toBe('Лёха находит странный конверт под порогом.');
    expect(report.nodes[0].quote).toBe('Лёха находит странный конверт под порогом.');
    expect(report.nodes[0].block_id).toBe('b1');
    expect(report.nodes[0].paragraph_index).toBe(1);
    expect(report.nodes[0].chapter_title).toBe('Глава 1: Пролог');

    expect(report.nodes[1].title).toBe('🎯 Выстрел (Развязка)');
    expect(report.nodes[1].node_type).toBe('destruction');
    expect(report.nodes[1].description).toBe('Письмо наконец прочитано перед всеми.');
    expect(report.nodes[1].quote).toBe('Письмо наконец прочитано перед всеми.');
    expect(report.nodes[1].block_id).toBe('b2');
    expect(report.nodes[1].paragraph_index).toBe(2);
    expect(report.nodes[1].chapter_title).toBe('Глава 3: Развязка');
  });

  it('opens journey for a narrative gun and generates milestones even if no explicit milestones in DB', async () => {
    vi.mocked(plotApi.getPlotPromise).mockResolvedValueOnce({
      id: 'plot_promises:secret_letter',
      title: 'Тайна письма',
      kind: 'gun',
      status: 'planted',
      note: null,
      chapter_id: 'chapters:ch1',
      paragraph_index: 3,
      block_id: 'b1',
      participant_ids: ['entities:char1'],
      arcs: [],
      arc_id: null,
      arc_phase: null,
      location_id: null,
      timeline_event_id: null,
      milestones: [],
    });

    const { openJourney, selectedJourney, selectedItem, isJourneyModalOpen, isJourneyLoading } =
      useChekhovGunTracker('test_proj');

    const gun = sampleReport.items[0];
    await openJourney(gun);

    expect(isJourneyModalOpen.value).toBe(true);
    expect(isJourneyLoading.value).toBe(false);
    expect(selectedItem.value?.name).toBe('Тайна письма');
    expect(selectedJourney.value).not.toBeNull();
    expect(selectedJourney.value?.item_name).toBe('Тайна письма');
    expect(selectedJourney.value?.nodes.length).toBe(1);
    expect(selectedJourney.value?.nodes[0].title).toBe('🌱 Завязка (Посадка ружья)');
  });
});
