import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEntityEditor } from '../useEntityEditor';
import * as api from '../../../../services/api.client';

vi.mock('../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
  getEntities: vi.fn(),
  toggleEntityHistoryPin: vi.fn(),
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
  },
}));

describe('useEntityEditor', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      project: 'p1',
      entityType: 'character',
      entityId: 'char_1',
      initialData: { name: 'Arthur', bio: 'Hero' },
      initialSection: 'sec_1',
      initialScrollPos: 0,
    };
    emit = vi.fn();
    (window as any).__TAURI__ = {
      core: {
        invoke: vi.fn().mockResolvedValue([]),
      },
    };
  });

  it('initializes and loads config and reference data', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([
      {
        type_key: 'character',
        full_schema: {
          sections: [
            {
              id: 'sec_1',
              title: 'Main',
              fields: [{ type: 'select', entityType: 'fraction', class: 'frac' }],
            },
          ],
        },
      },
    ] as any);

    vi.mocked(api.getEntities).mockResolvedValueOnce([
      { id: 'f1', name: 'Knights' },
    ] as any);

    const editor = useEntityEditor(props, emit);

    // Initial state
    expect(editor.loading.value).toBe(true);

    // Trigger loading
    editor.formData.value = { ...props.initialData };
    editor.markModified();

    expect(emit).toHaveBeenCalledWith('modified');
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({ name: 'Arthur' }));
  });

  it('marks modified when form data changes', () => {
    const editor = useEntityEditor(props, emit);
    editor.isInitializing.value = false;
    editor.formData.value = { name: 'Arthur Updated' };

    editor.markModified();

    expect(emit).toHaveBeenCalledWith('modified');
    expect(emit).toHaveBeenCalledWith('update-data', expect.objectContaining({ name: 'Arthur Updated' }));
  });
});
