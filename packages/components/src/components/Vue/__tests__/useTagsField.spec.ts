import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useTagsField } from '../useTagsField';
import * as apiService from '../../../ts/services/api.service';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string) => k
  })
}));

vi.mock('../../../ts/services/api.service', () => ({
  invoke: vi.fn(),
  processIds: vi.fn((val) => val)
}));

describe('useTagsField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses modelValue array and strings', () => {
    const emit = vi.fn();
    const field = useTagsField({ modelValue: ['маг', 'север'], project: 'p1' }, emit);

    expect(field.selectedTags.value).toEqual(['маг', 'север']);
  });

  it('falls back to get_entities when get_tags fails', async () => {
    const emit = vi.fn();
    vi.mocked(apiService.invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_tags') throw new Error('Not implemented');
      if (cmd === 'get_entities') {
        return [
          { id: '1', tags: ['дракон', 'север'] },
          { id: '2', tags: ['маг', 'север'] }
        ];
      }
      return [];
    });

    const field = useTagsField({ modelValue: [], project: 'p1' }, emit);
    field.openDropdown();
    await flushPromises();

    expect(field.filteredTags.value.map(t => t.name)).toContain('дракон');
    expect(field.filteredTags.value.map(t => t.name)).toContain('маг');
    expect(field.filteredTags.value.map(t => t.name)).toContain('север');
  });

  it('adds tags on ww:tags-updated event', async () => {
    const emit = vi.fn();
    vi.mocked(apiService.invoke).mockResolvedValue([]);

    const field = useTagsField({ modelValue: [], project: 'p1' }, emit);
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ww:tags-updated', {
      detail: { project: 'p1', tags: ['новое_имя'] }
    }));
    await flushPromises();

    expect(field.filteredTags.value.map(t => t.name)).toContain('новое_имя');
  });
});
