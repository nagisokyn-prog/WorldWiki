import { describe, it, expect, vi } from 'vitest';
import { useChekhovTrackerToolbar } from '../useChekhovTrackerToolbar';
import type { ChekhovTrackerToolbarProps } from '../ChekhovTrackerToolbar.model';

describe('useChekhovTrackerToolbar', () => {
  it('emits scope click and reset filter', () => {
    const emit = vi.fn();
    const props: ChekhovTrackerToolbarProps = {
      filter: { scope: 'guns', search: '', itemType: 'all', usageState: 'all' },
      gunsCount: 5,
      itemsCount: 10,
      totalCount: 15,
      itemTypes: ['Оружие'],
    };

    const { onScopeClick, onResetClick } = useChekhovTrackerToolbar(props, emit as unknown as Parameters<typeof useChekhovTrackerToolbar>[1]);
    onScopeClick('items');
    expect(emit).toHaveBeenCalledWith('set-scope', 'items');

    onResetClick();
    expect(emit).toHaveBeenCalledWith('reset-filter');
  });
});
