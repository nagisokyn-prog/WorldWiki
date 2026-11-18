import { describe, it, expect } from 'vitest';
import { isGunItem, buildGunJourneyReport } from '../chekhovGunTracker.utils';
import type { TrackedItem } from '../ChekhovGunTracker.model';

describe('chekhovGunTracker.utils', () => {
  it('correctly identifies gun items', () => {
    const item1: TrackedItem = {
      id: 'plot_promises:1',
      name: 'Old Gun',
      item_type: 'Unknown',
      status_category: 'Active',
      chapters_sleeping: 0,
    };
    const item2: TrackedItem = {
      id: 'entities:sword',
      name: 'Sword',
      item_type: 'Чеховское ружьё',
      status_category: 'Active',
      chapters_sleeping: 0,
    };
    const item3: TrackedItem = {
      id: 'entities:box',
      name: 'Wooden Box',
      item_type: 'Предмет',
      status_category: 'Active',
      chapters_sleeping: 0,
    };

    expect(isGunItem(item1)).toBe(true);
    expect(isGunItem(item2)).toBe(true);
    expect(isGunItem(item3)).toBe(false);
  });

  it('handles broken/resolved gun journey with bigint chapter sort_order and missing milestone fields', () => {
    const report = buildGunJourneyReport(
      {
        id: 'gun_broken',
        item_name: 'Сломанное ружьё',
        item_type: '',
        status_category: '',
        is_resolved: true,
        is_broken: true,
        chapters_present: [],
        last_chapter_order: 4,
      } as any,
      {
        id: 'gun_broken',
        status: 'broken',
        milestones: [
          {
            stage: 'resolution',
            chapter_id: 'chapters:99',
            quote: '',
            note: 'Сорвалось',
            block_id: '',
            order_index: undefined,
          },
        ],
      } as any,
      [{ id: { String: 'chapters:99' }, sort_order: BigInt(9), title: '' }] as any
    );

    expect(report.item_type).toBe('Чеховское ружьё');
    expect(report.status_category).toBe('Заряжено');
    expect(report.nodes.length).toBeGreaterThanOrEqual(1);

    const brokenNoMilestones = buildGunJourneyReport(
      { id: 'gun_b2', item_name: 'Срыв', status_category: '', is_resolved: true, is_broken: true, chapters_present: [] } as any,
      { id: 'gun_b2', status: 'broken', milestones: [] } as any,
      []
    );
    expect(brokenNoMilestones.nodes.some((n) => n.title === '💥 Срыв ружья')).toBe(true);

    const resolvedReport = buildGunJourneyReport(
      { id: 'gun_ok', item_name: 'Ружьё', status_category: 'Выстрел', is_resolved: true, is_broken: false, chapters_present: [] } as any,
      null,
      []
    );
    expect(resolvedReport.nodes.some((n) => n.title === '🎯 Выстрел (Развязка)')).toBe(true);
  });
});
