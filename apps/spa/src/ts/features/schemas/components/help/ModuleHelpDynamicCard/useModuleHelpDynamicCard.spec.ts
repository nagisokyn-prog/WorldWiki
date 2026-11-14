import { describe, it, expect, vi } from 'vitest';
import { useModuleHelpDynamicCard } from './useModuleHelpDynamicCard';
import type { ModuleHelpDynamicCardProps } from './ModuleHelpDynamicCard.model';
import type { SchemaFieldDef } from '@/features/schemas/types/schemaReference.types';

describe('useModuleHelpDynamicCard', () => {
  it('delegates field helpers to props', () => {
    const props: ModuleHelpDynamicCardProps = {
      isChapterField: vi.fn(() => false),
      isEntityOrChapterSelect: vi.fn(() => true),
      getSelectOptions: vi.fn(() => [{ value: 'b', label: 'B' }])
    } as unknown as ModuleHelpDynamicCardProps;

    const card = useModuleHelpDynamicCard(props);
    const field = { id: 'f2' } as SchemaFieldDef;

    expect(card.isChapterField(field)).toBe(false);
    expect(card.isEntityOrChapterSelect(field)).toBe(true);
    expect(card.getSelectOptions(field)).toEqual([{ value: 'b', label: 'B' }]);
  });
});

