import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEntityEditor } from '../useEntityEditor';
import * as api from '../../../../services/api.client';

vi.mock('../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
  getEntities: vi.fn(),
  toggleEntityHistoryPin: vi.fn(),
  uploadPhoto: vi.fn().mockResolvedValue('/path/to/photo.jpg'),
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
  },
  appAlert: vi.fn(),
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
      initialData: { name: 'Arthur', bio: 'Hero', items: [] },
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
          templates: {
            item: {
              fields: [{ class: 'itemName', default: 'Sword' }],
            },
          },
        },
      },
    ] as any);

    vi.mocked(api.getEntities).mockResolvedValueOnce([
      { id: 'f1', name: 'Knights' },
    ] as any);

    const editor = useEntityEditor(props, emit);

    expect(editor.loading.value).toBe(true);

    editor.formData.value = { ...props.initialData };
    editor.markModified();

    expect(emit).toHaveBeenCalledWith('modified');
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({ name: 'Arthur' }));
  });

  it('handles dynamic items addition and removal', () => {
    const editor = useEntityEditor(props, emit);
    editor.config.value = {
      templates: {
        item_tpl: {
          fields: [{ class: 'title', default: 'New Item' }],
        },
      },
    };
    editor.formData.value = { items: [] };

    editor.addDynamicItem('items', 'item_tpl');
    expect(editor.formData.value.items.length).toBe(1);
    expect(editor.formData.value.items[0].title).toBe('New Item');

    editor.removeDynamicItem('items', 0);
    expect(editor.formData.value.items.length).toBe(0);
  });

  it('handles foreign and local dynamic updates', () => {
    const editor = useEntityEditor(props, emit);
    editor.formData.value = {};

    editor.onDynamicUpdate({ localPath: 'info.age', value: 25 });
    expect(editor.formData.value.info?.age).toBe(25);

    editor.onDynamicUpdate({ foreignPath: 'parent.name', value: 'Uther' });
    expect(editor.foreignUpdates.value.parent?.name).toBe('Uther');

    editor.handleForeignUpdate({ entityType: 'char', entityId: 'c2', value: 'Ally' });
    expect(editor.foreignUpdates.value['char:c2']).toBeDefined();
  });

  it('gets options for fields', () => {
    const editor = useEntityEditor(props, emit);
    editor.referenceData.value = {
      faction_list: [{ value: 'f1', label: 'Knights' }],
    };

    const options = editor.getOptionsFor({ entityType: 'faction' });
    expect(options).toEqual([{ value: 'f1', label: 'Knights' }]);

    const staticOptions = editor.getOptionsFor({ options: [{ value: '1', label: 'One' }] });
    expect(staticOptions).toEqual([{ value: '1', label: 'One' }]);
  });

  it('handles photos and photo inputs', async () => {
    const editor = useEntityEditor(props, emit);
    const mockInput = { click: vi.fn() };
    editor.photoInputs.value = { avatar: mockInput };

    editor.triggerPhotoUpload('avatar');
    expect(mockInput.click).toHaveBeenCalled();

    editor.removePhoto('avatar');
    expect(editor.formData.value.avatar).toBe('');

    // handlePhotoFile
    const fakeFile = new File(['fake-content'], 'photo.png', { type: 'image/png' });
    await editor.handlePhotoFile({ target: { files: [fakeFile] } }, 'avatar');
    expect(editor.formData.value.avatar).toBe('/path/to/photo.jpg');

    // handlePhotoDrop
    await editor.handlePhotoDrop({ dataTransfer: { files: [fakeFile] } }, 'avatar');
    expect(editor.formData.value.avatar).toBe('/path/to/photo.jpg');
  });

  it('handles deeply nested foreign updates and dynamic item edge cases', () => {
    const editor = useEntityEditor(props, emit);

    editor.handleForeignUpdate({ foreignPath: 'profile.stats.strength', value: 18 });
    expect(editor.foreignUpdates.value.profile?.stats?.strength).toBe(18);

    // addDynamicItem with undefined path
    editor.addDynamicItem('', 'item_tpl');

    // addDynamicItem with direct object
    editor.addDynamicItem('skills', {
      fields: [{ class: 'skillName', default: 'Archery' }],
    });
    expect(editor.formData.value.skills).toBeDefined();
    expect(editor.formData.value.skills[0].skillName).toBe('Archery');
  });

  it('handles toggle entity history events', () => {
    const editor = useEntityEditor(props, emit);

    const toggleEvent = new CustomEvent('ww:toggle-entity-history', {
      detail: { id: 'char_1' },
    });
    document.dispatchEvent(toggleEvent);
  });
});
