import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useEntityEditor } from '../useEntityEditor';
import * as api from '../../../../services/api.client';
import { appAlert } from '@worldwiki/components';

vi.mock('../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
  getEntities: vi.fn(),
  toggleEntityHistoryPin: vi.fn(),
  uploadPhoto: vi.fn().mockResolvedValue('/path/to/photo.jpg'),
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
    onChange: vi.fn(),
  },
  appAlert: vi.fn(),
}));

describe('useEntityEditor', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionStorage.clear();

    props = {
      project: 'p1',
      entityType: 'character',
      entityId: 'char_1',
      initialData: { name: 'Arthur', bio: 'Hero', items: [] },
      initialSection: 'sec_1',
      initialScrollPos: 100,
    };
    emit = vi.fn();
    (window as any).__TAURI__ = {
      core: {
        invoke: vi.fn().mockResolvedValue([]),
      },
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('ui_editor.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ templates: { shared_tpl: { fields: [] } } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sections: [{ id: 'static_sec', title: 'Static' }] }),
      });
    }) as any;
  });

  afterEach(() => {
    vi.useRealTimers();
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
              dynamicContainers: [{ template: 'inventory' }, { id: 'custom_dc', dataPath: 'custom_path' }],
            },
          ],
          templates: {
            item: {
              fields: [{ class: 'itemName', type: 'multiselect', entityType: 'item' }],
              dynamicContainers: [{ id: 'sub_dc', fields: [{ type: 'select', entityType: 'sub_item' }] }],
            },
          },
        },
      },
    ] as any);

    vi.mocked(api.getEntities).mockResolvedValue([
      { id: 'f1', name: 'Knights' },
    ] as any);

    const editor = useEntityEditor(props, emit);
    await editor.loadConfigAndData();

    expect(editor.loading.value).toBe(false);
    expect(editor.config.value.sections.length).toBe(1);
    expect(editor.config.value.sections[0].dynamicContainers[0].id).toBe('dyn_inventory');
    expect(emit).toHaveBeenCalledWith('section-change', 'sec_1');

    editor.formData.value = { ...props.initialData, name: 'Arthur Pendragon' };
    editor.markModified();

    expect(emit).toHaveBeenCalledWith('modified');
    expect(emit).toHaveBeenCalledWith('update:modelValue', expect.objectContaining({ name: 'Arthur Pendragon' }));
  });

  it('handles sandbox preview config from sessionStorage', async () => {
    sessionStorage.setItem(
      'sandbox_preview_config',
      JSON.stringify({
        sections: [{ id: 'preview_sec', title: 'Preview' }],
      })
    );

    props.entityId = 'preview';

    const editor = useEntityEditor(props, emit);
    await editor.loadConfigAndData();

    expect(editor.config.value.sections[0].id).toBe('preview_sec');
  });

  it('handles static schema fallback when entity schema is not in database', async () => {
    vi.mocked(api.getEntitySchemas).mockResolvedValueOnce([]);

    const editor = useEntityEditor(props, emit);
    await editor.loadConfigAndData();

    expect(editor.config.value).toBeDefined();
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

    editor.handleForeignUpdate({ foreignPath: 'profile.stats.strength', value: 18 });
    expect(editor.foreignUpdates.value.profile?.stats?.strength).toBe(18);
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

  it('handles photo upload failure with appAlert', async () => {
    vi.mocked(api.uploadPhoto).mockRejectedValueOnce(new Error('Upload failed'));

    const editor = useEntityEditor(props, emit);
    const fakeFile = new File(['bad-content'], 'test.png', { type: 'image/png' });

    await editor.handlePhotoFile({ target: { files: [fakeFile] } }, 'avatar');
    expect(appAlert).toHaveBeenCalledWith('Ошибка загрузки фото');

    vi.mocked(api.uploadPhoto).mockRejectedValueOnce(new Error('Drop upload failed'));
    await editor.handlePhotoDrop({ dataTransfer: { files: [fakeFile] } }, 'avatar');
    expect(appAlert).toHaveBeenCalledWith('Ошибка загрузки фото');
  });

  it('reacts to initialData prop changes when not in history preview mode', async () => {
    const reactiveProps = reactive({
      project: 'p1',
      entityType: 'character',
      entityId: 'char_1',
      initialData: { name: 'Arthur', items: [] },
      initialSection: 'sec_1',
      initialScrollPos: 0,
    });

    const editor = useEntityEditor(reactiveProps, emit);
    editor.formData.value = { name: 'Arthur', items: [] };

    reactiveProps.initialData = { name: 'King Arthur', items: ['Excalibur'] };
    await nextTick();

    expect(editor.formData.value.name).toBe('King Arthur');
  });

  it('handles toggle entity history events', () => {
    const editor = useEntityEditor(props, emit);

    const toggleEvent = new CustomEvent('ww:toggle-entity-history', {
      detail: { id: 'char_1' },
    });
    document.dispatchEvent(toggleEvent);
  });
});
