import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useSchemaEditorMain } from '../useSchemaEditorMain';
import * as api from '../../../../services/api.client';
import { appAlert } from '@worldwiki/components';

vi.mock('../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn().mockResolvedValue([]),
  saveEntitySchema: vi.fn(),
  getSchemaHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
  appConfirm: vi.fn(),
}));

describe('useSchemaEditorMain', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      project: 'p1',
      entityType: 'character',
      schemaType: 'character',
    };
    emit = vi.fn();
  });

  it('mounts, handles resize, scroll, and unmounts cleanly', async () => {
    const TestComp = defineComponent({
      props: ['project', 'entityType', 'schemaType'],
      emits: ['modified', 'scroll-change'],
      setup(p, { emit: e }) {
        return { ...useSchemaEditorMain(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp, { props });
    await flushPromises();

    const vm = wrapper.vm as any;

    // Resize
    vm.startResize({ clientX: 100 } as any);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    // Scroll
    vm.handleScroll({ target: { scrollTop: 80 } });
    expect(wrapper.emitted('scroll-change')).toBeDefined();

    // Keydown toggle catalog
    document.dispatchEvent(new KeyboardEvent('keydown', {
      ctrlKey: true,
      shiftKey: true,
      code: 'KeyB',
    }));
    expect(vm.showCatalog).toBe(false);

    // Global save event
    document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', {
      detail: { entityType: 'character' },
    }));

    wrapper.unmount();
  });

  it('saves schema with atomic and dynamic fields, handles history reload and errors', async () => {
    const main = useSchemaEditorMain(props, emit);
    main.schema.value = {
      sections: [
        {
          id: 'sec_1',
          items: [
            { type: 'text', class: 'name' }, // Atomic
            { template: 'timeline' }, // Dynamic container
          ],
        },
      ],
    };
    main.isHistoryPreviewMode.value = true;
    main.showHistory.value = true;

    // Success save
    vi.mocked(api.saveEntitySchema).mockResolvedValueOnce(undefined as any);
    await main.saveSchema();
    expect(appAlert).toHaveBeenCalledWith('Схема сохранена!');
    expect(main.isHistoryPreviewMode.value).toBe(false);

    // Error save
    vi.mocked(api.saveEntitySchema).mockRejectedValueOnce(new Error('Save failed'));
    await main.saveSchema();
    expect(appAlert).toHaveBeenCalledWith('Ошибка сохранения');
  });

  it('covers fallback properties, section without items, and non-matching global save events', async () => {
    // 1. props without schemaType (falling back to entityType)
    const mainNoSchemaType = useSchemaEditorMain({ project: 'p1', entityType: 'location' }, emit);
    expect(mainNoSchemaType.localEntityType.value).toBe('location');

    // 2. schema with section without items, and missing icon/color
    mainNoSchemaType.schema.value = {
      sections: [{ id: 'sec_empty' }],
    };
    vi.mocked(api.saveEntitySchema).mockResolvedValueOnce(undefined as any);
    await mainNoSchemaType.saveSchema();
    expect(api.saveEntitySchema).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        icon: '📄',
        color: '#333333',
      }),
      expect.anything()
    );

    // 3. Non-matching trigger-schema-save event
    document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', {
      detail: { entityType: 'other_type' },
    }));

    // 4. trigger-schema-save event with null detail
    document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', { detail: null }));
  });
});
