import { describe, it, expect, vi } from 'vitest';
import { useEntityHiddenManager } from './useEntityHiddenManager';

describe('useEntityHiddenManager', () => {
  it('computes display lists for hidden sections, fields, and containers', () => {
    const props = {
      isOpen: true,
      totalHiddenCount: 3,
      hiddenSections: ['sec_1'],
      hiddenFields: ['field_1'],
      hiddenContainers: ['cont_1'],
      sections: [{ id: 'sec_1', title: 'Раздел 1' }] as any,
      getFieldLabel: vi.fn((k: string) => `Label for ${k}`),
      getContainerTitle: vi.fn((k: string) => `Title for ${k}`),
    };

    const { hiddenSectionsList, hiddenFieldsList, hiddenContainersList } = useEntityHiddenManager(props);

    expect(hiddenSectionsList.value).toEqual([{ id: 'sec_1', label: 'Раздел 1' }]);
    expect(hiddenFieldsList.value).toEqual([{ id: 'field_1', label: 'Label for field_1' }]);
    expect(hiddenContainersList.value).toEqual([{ id: 'cont_1', label: 'Title for cont_1' }]);
  });
});

