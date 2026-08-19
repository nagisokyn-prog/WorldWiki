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
        return { ...useSchemaEditorMain(p as any, e as any) };
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

    // Global save event matching schemaType
    document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', {
      detail: { entityType: 'character' },
    }));

    wrapper.unmount();
  });

  it('saves schema with atomic and dynamic fields, handles history reload and errors', async () => {
    const main = useSchemaEditorMain(props, emit);
    main.schema.value = {
      name: 'Custom Character',
      icon: '🛡️',
      color: '#ff0000',
      sections: [
        {
          id: 'sec_1',
          title: 'Main',
          icon: '📄',
          items: [
            { type: 'text', class: 'name' }, // Atomic
            { template: 'timeline' }, // Dynamic container
          ],
        },
      ],
    } as any;
    main.isHistoryPreviewMode.value = true;
    main.showHistory.value = true;

    // Success save
    vi.mocked(api.saveEntitySchema).mockResolvedValueOnce(undefined as any);
    await main.saveSchema();
    expect(appAlert).toHaveBeenCalledWith('Схема сохранена!');
    expect(main.isHistoryPreviewMode.value).toBe(false);
    expect(api.saveEntitySchema).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        icon: '🛡️',
        color: '#ff0000',
        type_name: 'character',
      }),
      expect.anything()
    );

    // Error save
    vi.mocked(api.saveEntitySchema).mockRejectedValueOnce(new Error('Save failed'));
    await main.saveSchema();
    expect(appAlert).toHaveBeenCalledWith('Ошибка сохранения');
  });

  it('covers fallback properties, empty project, section without items, and non-matching global save events', async () => {
    // 1. props without schemaType and without entityType
    const mainEmptyProps = useSchemaEditorMain({ project: '' }, emit);
    expect(mainEmptyProps.localEntityType.value).toBe('');

    // 2. props without schemaType (falling back to entityType)
    const mainNoSchemaType = useSchemaEditorMain({ project: '', entityType: 'location' }, emit);
    expect(mainNoSchemaType.localEntityType.value).toBe('location');

    // 3. schema with section without items, missing name/icon/color, and empty project
    mainNoSchemaType.schema.value = {
      sections: [{ id: 'sec_empty', title: 'Empty', icon: '📄', items: [] }],
    } as any;
    vi.mocked(api.saveEntitySchema).mockResolvedValueOnce(undefined as any);
    await mainNoSchemaType.saveSchema();
    expect(api.saveEntitySchema).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        project_id: null,
        type_name: 'location',
        icon: '📄',
        color: '#333333',
      }),
      expect.anything()
    );

    // 4. Trigger-schema-save event matching entityType (when schemaType is missing)
    const TestComp2 = defineComponent({
      props: ['project', 'entityType'],
      setup(p, { emit: e }) {
        return { ...useSchemaEditorMain(p as any, e as any) };
      },
      template: '<div></div>',
    });
    const wrapper2 = mount(TestComp2, { props: { project: 'p1', entityType: 'faction' } });
    await flushPromises();

    document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', {
      detail: { entityType: 'faction' },
    }));

    // 5. Non-matching trigger-schema-save event
    document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', {
      detail: { entityType: 'other_type' },
    }));

    // 6. trigger-schema-save event with null detail
    document.dispatchEvent(new CustomEvent('ww:trigger-schema-save', { detail: null }));

    wrapper2.unmount();
  });
});
