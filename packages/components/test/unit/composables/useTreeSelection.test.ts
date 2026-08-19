// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useTreeSelection } from '../../../src/ts/composables/useTreeSelection';

describe('useTreeSelection', () => {
  const items = [
    { id: '1', title: 'Chapter 1' },
    { id: '2', title: 'Chapter 2' },
    { id: '3', title: 'Chapter 3' },
    { id: '4', title: 'Chapter 4' },
  ];

  it('handles single click selection', () => {
    const onSelectionChange = vi.fn();
    const { handleClick, isSelected, selectedCount, selectedIds } = useTreeSelection({ onSelectionChange });

    handleClick({} as MouseEvent, items[0], items);

    expect(isSelected('1')).toBe(true);
    expect(isSelected('2')).toBe(false);
    expect(selectedCount.value).toBe(1);
    expect(selectedIds.value).toEqual(['1']);
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('handles Ctrl+Click (toggle selection)', () => {
    const { handleClick, isSelected, selectedCount } = useTreeSelection();

    handleClick({ ctrlKey: true } as MouseEvent, items[0], items);
    handleClick({ ctrlKey: true } as MouseEvent, items[1], items);

    expect(isSelected('1')).toBe(true);
    expect(isSelected('2')).toBe(true);
    expect(selectedCount.value).toBe(2);

    // Toggle off
    handleClick({ ctrlKey: true } as MouseEvent, items[0], items);
    expect(isSelected('1')).toBe(false);
    expect(isSelected('2')).toBe(true);
    expect(selectedCount.value).toBe(1);
  });

  it('handles Shift+Click (range selection)', () => {
    const { handleClick, isSelected, selectedCount } = useTreeSelection();

    // Select start
    handleClick({} as MouseEvent, items[0], items);
    // Shift click end
    handleClick({ shiftKey: true } as MouseEvent, items[2], items);

    expect(isSelected('1')).toBe(true);
    expect(isSelected('2')).toBe(true);
    expect(isSelected('3')).toBe(true);
    expect(isSelected('4')).toBe(false);
    expect(selectedCount.value).toBe(3);
  });

  it('selectAll, clearSelection, addToSelection', () => {
    const { selectAll, clearSelection, addToSelection, hasSelection, selectedCount } = useTreeSelection();

    addToSelection('1');
    expect(hasSelection.value).toBe(true);
    expect(selectedCount.value).toBe(1);

    selectAll(items);
    expect(selectedCount.value).toBe(4);

    clearSelection();
    expect(selectedCount.value).toBe(0);
    expect(hasSelection.value).toBe(false);
  });

  it('deleteSelected calls onDelete callback with selected ids and resets state', async () => {
    const onDelete = vi.fn();
    const { addToSelection, deleteSelected, selectedCount } = useTreeSelection({ onDelete });

    addToSelection('1');
    addToSelection('2');

    await deleteSelected();
    expect(onDelete).toHaveBeenCalledWith(['1', '2']);
    expect(selectedCount.value).toBe(0);
  });

  const makeKeyEvt = (key: string, opts: Record<string, unknown> = {}) => ({
    key,
    target: document.createElement('div'),
    preventDefault: vi.fn(),
    ...opts,
  } as any);

  it('handleKeydown handles Escape, Ctrl+A, and Delete keys', async () => {
    const onDelete = vi.fn();
    const { addToSelection, handleKeydown, selectedCount } = useTreeSelection({ onDelete });

    addToSelection('1');

    // Escape clears
    await handleKeydown(makeKeyEvt('Escape'), items);
    expect(selectedCount.value).toBe(0);

    // Ctrl+A selects all
    await handleKeydown(makeKeyEvt('a', { ctrlKey: true }), items);
    expect(selectedCount.value).toBe(4);

    // Delete triggers deletion
    await handleKeydown(makeKeyEvt('Delete'), items);
    expect(onDelete).toHaveBeenCalled();
  });

  it('handleKeydown navigates with ArrowUp and ArrowDown and scrolls into view', async () => {
    vi.useFakeTimers();
    const scrollMock = vi.fn();
    const div = document.createElement('div');
    div.setAttribute('data-id', '1');
    div.scrollIntoView = scrollMock;
    document.body.appendChild(div);

    const { handleKeydown, isSelected, selectedIds } = useTreeSelection();

    await handleKeydown(makeKeyEvt('ArrowDown'), items);
    expect(selectedIds.value).toEqual(['1']);

    vi.advanceTimersByTime(20);
    expect(scrollMock).toHaveBeenCalledWith({ block: 'nearest' });

    await handleKeydown(makeKeyEvt('ArrowDown'), items);
    expect(selectedIds.value).toEqual(['2']);

    await handleKeydown(makeKeyEvt('ArrowUp'), items);
    expect(selectedIds.value).toEqual(['1']);

    document.body.removeChild(div);
    vi.useRealTimers();
  });
});
