import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlanningPanel } from '../usePlanningPanel';
import * as api from '../../../../services/api.client';

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
  appConfirm: vi.fn(),
}));

vi.mock('../../../../services/api.client', () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  toggleTodo: vi.fn(),
  deleteTodo: vi.fn(),
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

  it('computes node icons and handles missing parent props', async () => {
    // chapter icon
    const chapterPanel = usePlanningPanel(props);
    expect(chapterPanel.nodeIcon.value).toBe('📖');

    // volume icon
    const volumePanel = usePlanningPanel({ ...props, parentType: 'volume', parentTitle: '' });
    expect(volumePanel.nodeIcon.value).toBe('📚');
    expect(volumePanel.nodeName.value).toBe('Без названия');

    // Missing project / parentType / parentId
    const emptyPanel = usePlanningPanel({});
    await emptyPanel.load();
    expect(emptyPanel.items.value).toEqual([]);

    // API error
    vi.mocked(api.getTodos).mockRejectedValueOnce(new Error('Load error'));
    await chapterPanel.load();
    expect(chapterPanel.items.value).toEqual([]);
  });

  it('adds, indents, toggles, saves and deletes items with error rollbacks', async () => {
    vi.mocked(api.getTodos).mockResolvedValue([
      { id: 'p1', owner_id: 'ch_1', text: 'Task 1', is_done: false },
    ] as any);
    vi.mocked(api.createTodo).mockResolvedValue('p_new');
    vi.mocked(api.deleteTodo).mockResolvedValue(undefined as any);

    const panel = usePlanningPanel(props);
    await panel.load();

    // Add items
    await panel.addItem();
    await panel.addItemAfter(0, 1);
    expect(panel.items.value.length).toBe(3);

    // Save empty item without id (early return)
    const emptyItem = { id: '', text: '   ', done: false, indent: 0 };
    await panel.saveItem(emptyItem);

    // Save error catch
    vi.mocked(api.updateTodo).mockRejectedValueOnce(new Error('Save error'));
    await panel.saveItem(panel.items.value[0]);

    // Toggle item with id error rollback
    const item = panel.items.value[0];
    vi.mocked(api.toggleTodo).mockRejectedValueOnce(new Error('Toggle error'));
    await panel.toggleItem(item);
    expect(item.done).toBe(false);

    // Toggle item without id
    const newItem = { id: '', text: 'New', done: false, indent: 0 };
    await panel.toggleItem(newItem);
    expect(newItem.done).toBe(true);

    // Indent item bounds
    await panel.indentItem(item, -5);
    expect(item.indent).toBe(0);
    await panel.indentItem(item, 10);
    expect(item.indent).toBe(4);

    // Delete item
    await panel.deleteItem(item, 0);
    expect(panel.items.value.length).toBe(2);

    // Delete item without id
    await panel.deleteItem({ id: '', text: '', done: false, indent: 0 }, 0);
  });

  it('handles onDeleteKey on backspace with empty text vs non-empty', async () => {
    const panel = usePlanningPanel(props);
    const item1 = { id: '1', text: 'Item 1', done: false, indent: 0 };
    const item2 = { id: '2', text: '', done: false, indent: 0 };
    panel.items.value = [item1, item2];

    const preventDefault = vi.fn();

    // Non-backspace key
    await panel.onDeleteKey({ key: 'Enter', preventDefault } as any, item2, 1);
    expect(preventDefault).not.toHaveBeenCalled();

    // Backspace with text
    await panel.onDeleteKey({ key: 'Backspace', preventDefault } as any, item1, 0);
    expect(preventDefault).not.toHaveBeenCalled();

    // Backspace with empty text
    await panel.onDeleteKey({ key: 'Backspace', preventDefault } as any, item2, 1);
    expect(preventDefault).toHaveBeenCalled();
    expect(panel.items.value.length).toBe(1);
  });

  it('covers progressPct, sort_order fallbacks, toggleItem success and DOM input focus', async () => {
    const panel = usePlanningPanel(props);
    expect(panel.progressPct.value).toBe(0);

    // Load with missing sort_order and indent
    vi.mocked(api.getTodos).mockResolvedValueOnce([
      { id: 'p1', owner_id: 'ch_1', text: 'Task 1', is_done: true, sort_order: undefined },
      { id: 'p2', owner_id: 'ch_1', text: 'Task 2', is_done: false, sort_order: 1 },
    ] as any);
    await panel.load();
    expect(panel.progressPct.value).toBe(50);

    // Toggle item with id (success path)
    vi.mocked(api.toggleTodo).mockResolvedValueOnce({ id: 'p1', is_done: false } as any);
    await panel.toggleItem(panel.items.value[0]);
    expect(panel.items.value[0].done).toBe(false);

    // DOM focus inputs in addItem, addItemAfter, onDeleteKey
    const input1 = document.createElement('input');
    input1.className = 'plan-text';
    const input2 = document.createElement('input');
    input2.className = 'plan-text';
    const focusSpy1 = vi.spyOn(input1, 'focus');
    const focusSpy2 = vi.spyOn(input2, 'focus');

    const container = document.createElement('div');
    container.appendChild(input1);
    container.appendChild(input2);
    panel.listEl.value = container;

    await panel.addItem();
    expect(focusSpy2).toHaveBeenCalled();

    await panel.addItemAfter(0, 0);
    expect(focusSpy2).toHaveBeenCalled();

    panel.items.value = [{ id: '1', text: 'T1', done: false, indent: 0 }, { id: '2', text: '', done: false, indent: 0 }];
    await panel.onDeleteKey({ key: 'Backspace', preventDefault: vi.fn() } as any, panel.items.value[1], 1);
    expect(focusSpy1).toHaveBeenCalled();
  });
});
