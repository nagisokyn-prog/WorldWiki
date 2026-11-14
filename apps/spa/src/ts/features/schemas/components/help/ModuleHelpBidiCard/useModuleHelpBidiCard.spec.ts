import { describe, it, expect, vi } from 'vitest';
import { useModuleHelpBidiCard } from './useModuleHelpBidiCard';
import type { ModuleHelpBidiCardProps } from './ModuleHelpBidiCard.model';
import type { SchemaFieldDef } from '@/features/schemas/types/schemaReference.types';

describe('useModuleHelpBidiCard', () => {
  it('delegates field helpers to props', () => {
    const props: ModuleHelpBidiCardProps = {
      isChapterField: vi.fn(() => true),
      isEntityOrChapterSelect: vi.fn(() => false),
      getSelectOptions: vi.fn(() => [{ value: 'a', label: 'A' }])
    } as unknown as ModuleHelpBidiCardProps;

    const card = useModuleHelpBidiCard(props);
    const field = { id: 'f1' } as SchemaFieldDef;

    expect(card.isChapterField(field)).toBe(true);
    expect(card.isEntityOrChapterSelect(field)).toBe(false);
    expect(card.getSelectOptions(field)).toEqual([{ value: 'a', label: 'A' }]);
  });
});

