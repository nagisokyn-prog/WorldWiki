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

  it('builds gun journey report with fallback nodes', () => {
    const item: TrackedItem = {
      id: 'plot_promises:test',
      name: 'A mysterious note',
      item_type: 'Чеховское ружьё',
      status_category: 'Заряжено',
      chapters_sleeping: 2,
    };

    const report = buildGunJourneyReport(item, null, []);
    expect(report.item_id).toBe('plot_promises:test');
    expect(report.nodes.length).toBeGreaterThan(0);
    expect(report.nodes[0].title).toContain('Завязка');
  });
});
