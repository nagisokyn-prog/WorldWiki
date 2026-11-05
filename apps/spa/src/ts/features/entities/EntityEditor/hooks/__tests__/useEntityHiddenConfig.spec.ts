import { describe, it, expect, vi } from 'vitest';
import { ref, shallowRef } from 'vue';
import { useEntityHiddenConfig, parseEntityHiddenConfig } from '../useEntityHiddenConfig';
import type { SchemaConfig, SchemaSection, SchemaField, DynamicContainer } from '../../EntityEditor.model';

describe('useEntityHiddenConfig', () => {
  it('parses raw hidden config correctly', () => {
    expect(parseEntityHiddenConfig(null)).toEqual({ sections: [], fields: [], containers: [] });
    expect(parseEntityHiddenConfig({ sections: ['s1'], fields: ['f1', 'f2'], containers: ['c1'] })).toEqual({
      sections: ['s1'],
      fields: ['f1', 'f2'],
      containers: ['c1'],
    });
  });

  it('correctly validates canHideSection', () => {
    const formData = ref<Record<string, unknown>>({});
    const config = shallowRef<SchemaConfig | null>({ sections: [] });
    const onChanged = vi.fn();
    const hook = useEntityHiddenConfig(formData, config, onChanged);

    const sec0: SchemaSection = { id: 'main', title: 'Main' };
    const sec1: SchemaSection = { id: 'extra', title: 'Extra' };
    const secSys: SchemaSection = { id: 'sys', title: 'System', isSystem: true };
    const secPrevent: SchemaSection = { id: 'prev', title: 'Prevent', preventHide: true };

    expect(hook.canHideSection(sec0, 0)).toBe(false);
    expect(hook.canHideSection(sec1, 1)).toBe(true);
    expect(hook.canHideSection(secSys, 1)).toBe(false);
    expect(hook.canHideSection(secPrevent, 1)).toBe(false);
  });

  it('correctly validates canHideField and protects system/required fields', () => {
    const formData = ref<Record<string, unknown>>({});
    const config = shallowRef<SchemaConfig | null>({
      sections: [
        {
          id: 'main',
          title: 'Main',
          fields: [
            { id: 'fName', path: 'name', label: 'Name', isSystem: true },
            { id: 'fBio', path: 'bio', label: 'Bio' },
          ],
        },
      ],
      titleField: 'name',
    });
    const onChanged = vi.fn();
    const hook = useEntityHiddenConfig(formData, config, onChanged);

    const fName: SchemaField = { id: 'fName', path: 'name', label: 'Name' };
    const fRequired: SchemaField = { id: 'fAge', path: 'age', label: 'Age', required: true };
    const fPrevent: SchemaField = { id: 'fId', path: 'id_code', label: 'ID', preventHide: true };
    const fNormal: SchemaField = { id: 'fBio', path: 'bio', label: 'Bio' };

    expect(hook.canHideField(fName)).toBe(false);
    expect(hook.canHideField(fRequired)).toBe(false);
    expect(hook.canHideField(fPrevent)).toBe(false);
    expect(hook.canHideField(fNormal)).toBe(true);
  });

  it('correctly validates canHideContainer', () => {
    const formData = ref<Record<string, unknown>>({});
    const config = shallowRef<SchemaConfig | null>({ sections: [] });
    const onChanged = vi.fn();
    const hook = useEntityHiddenConfig(formData, config, onChanged);

    const normalDc: DynamicContainer = { id: 'rel', title: 'Relations' };
    const sysDc: DynamicContainer = { id: 'sys', title: 'Sys', isSystem: true };
    const prevDc: DynamicContainer = { id: 'prev', title: 'Prev', preventHide: true };

    expect(hook.canHideContainer(normalDc)).toBe(true);
    expect(hook.canHideContainer(sysDc)).toBe(false);
    expect(hook.canHideContainer(prevDc)).toBe(false);
  });

  it('hides and unhides sections, fields and containers and syncs to formData', () => {
    const formData = ref<Record<string, unknown>>({ attributes: {} });
    const config = shallowRef<SchemaConfig | null>({ sections: [] });
    const onChanged = vi.fn();
    const hook = useEntityHiddenConfig(formData, config, onChanged);

    expect(hook.totalHiddenCount.value).toBe(0);

    hook.hideSection('sec_lore');
    expect(hook.isSectionHidden('sec_lore')).toBe(true);
    expect(hook.totalHiddenCount.value).toBe(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(formData.value._hidden).toEqual({ sections: ['sec_lore'], fields: [], containers: [] });

    hook.hideField('custom_hobby');
    expect(hook.isFieldHidden('custom_hobby')).toBe(true);
    expect(hook.totalHiddenCount.value).toBe(2);

    hook.hideContainer('dyn_notes');
    expect(hook.isContainerHidden('dyn_notes')).toBe(true);
    expect(hook.totalHiddenCount.value).toBe(3);

    // Unhide field
    hook.unhideField('custom_hobby');
    expect(hook.isFieldHidden('custom_hobby')).toBe(false);
    expect(hook.totalHiddenCount.value).toBe(2);

    // Unhide all
    hook.unhideAll();
    expect(hook.totalHiddenCount.value).toBe(0);
    expect(hook.isSectionHidden('sec_lore')).toBe(false);
  });
});

