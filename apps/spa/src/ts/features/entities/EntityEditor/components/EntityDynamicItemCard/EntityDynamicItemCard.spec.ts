import { describe, it, expect, vi } from 'vitest';
import { useEntityDynamicItemCard } from './useEntityDynamicItemCard';

describe('useEntityDynamicItemCard', () => {
  it('computes isCollapsed and itemSummary properly and handles updates', () => {
    const item = { title: 'Chapter Item' };
    const container = { id: 'c1', dataPath: 'events' };
    const emit = vi.fn();
    const props = {
      item,
      idx: 0,
      container,
      project: 'p1',
      isItemCollapsed: vi.fn((path, idx) => idx === 0),
      getItemSummary: vi.fn(() => 'Summary'),
      getResolvedTemplate: vi.fn(() => ({ fields: [{ id: 'f1', label: 'Field 1' }] } as any)),
      getProp: vi.fn((obj, path) => (obj as any)[path]),
      setProp: vi.fn((obj, path, val) => {
        (obj as any)[path] = val;
      }),
      getOptionsFor: vi.fn(() => []),
      isChapterField: vi.fn(() => false),
    };

    const card = useEntityDynamicItemCard(props as any, emit);

    expect(card.containerPath.value).toBe('events');
    expect(card.isCollapsed.value).toBe(true);
    expect(card.itemSummary.value).toBe('Summary');
    expect(card.templateFields.value).toHaveLength(1);

    card.toggleCollapse();
    expect(emit).toHaveBeenCalledWith('toggleCollapse', 'events', 0);

    card.remove();
    expect(emit).toHaveBeenCalledWith('remove', 'events', 0);

    card.updateProp('f1', 'new val');
    expect(props.setProp).toHaveBeenCalledWith(item, 'f1', 'new val');
    expect(emit).toHaveBeenCalledWith('modified');
  });
});

