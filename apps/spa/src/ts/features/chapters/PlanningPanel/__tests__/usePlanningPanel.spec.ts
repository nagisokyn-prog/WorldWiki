import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlanningPanel } from '../usePlanningPanel';
import * as api from '../../../../services/api.client';

vi.mock('../../../../services/api.client', () => ({
  getPlans: vi.fn(),
  savePlan: vi.fn(),
  deletePlan: vi.fn(),
}));

describe('usePlanningPanel', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      project: 'proj_1',
      parentType: 'chapter',
      parentId: 'ch_1',
      parentTitle: 'Chapter 1',
    };
  });

  it('computes node icon and progress pct', async () => {
    vi.mocked(api.getPlans).mockResolvedValueOnce([
      { id: 'p1', parent_type: 'chapter', parent_ref: 'ch_1', title: 'Task 1', completed: true, sort_order: 1 },
      { id: 'p2', parent_type: 'chapter', parent_ref: 'ch_1', title: 'Task 2', completed: false, sort_order: 2 },
    ] as any);

    const panel = usePlanningPanel(props);
    await Promise.resolve();

    expect(panel.nodeIcon.value).toBe('📖');
    expect(panel.nodeName.value).toBe('Chapter 1');
  });

  it('adds, indents, toggles, saves and deletes items', async () => {
    vi.mocked(api.getPlans).mockResolvedValue([
      { id: 'p1', parent_type: 'chapter', parent_ref: 'ch_1', title: 'Task 1', completed: false },
    ] as any);
    vi.mocked(api.savePlan).mockResolvedValue({ id: 'p_new' } as any);
    vi.mocked(api.deletePlan).mockResolvedValue(undefined as any);

    const panel = usePlanningPanel(props);
    await panel.load();

    await panel.addItem();
    expect(panel.items.value.length).toBe(2);

    await panel.addItemAfter(0, 1);
    expect(panel.items.value.length).toBe(3);

    const item = panel.items.value[0];
    await panel.indentItem(item, 1);
    expect(item.indent).toBe(1);

    await panel.toggleItem(item);
    expect(item.done).toBe(true);

    await panel.deleteItem(item, 0);
    expect(panel.items.value.length).toBe(2);
    expect(api.deletePlan).toHaveBeenCalledWith('p1');
  });
});
