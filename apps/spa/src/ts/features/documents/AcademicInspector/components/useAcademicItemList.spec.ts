import { describe, it, expect } from 'vitest';
import { useAcademicItemList } from './useAcademicItemList';

describe('useAcademicItemList', () => {
  it('formats items correctly with custom formatNumber', () => {
    const { displayItems } = useAcademicItemList({
      sectionTitle: 'Test Section',
      emptyMessage: 'Empty',
      items: [
        { id: '1', title: 'Chapter 1', number: 1 },
        { id: '2', title: 'Chapter 2', number: 2 },
      ],
      formatNumber: (n) => `§${n}`,
    });

    expect(displayItems.value).toHaveLength(2);
    expect(displayItems.value[0].displayNumber).toBe('§1');
    expect(displayItems.value[1].displayNumber).toBe('§2');
  });

  it('keeps raw number when formatNumber is not provided', () => {
    const { displayItems } = useAcademicItemList({
      sectionTitle: 'Test Section',
      emptyMessage: 'Empty',
      items: [{ id: '1', title: 'Item 1', number: 42 }],
    });

    expect(displayItems.value[0].displayNumber).toBe(42);
  });
});
