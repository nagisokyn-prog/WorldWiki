import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useRelationshipBlock } from '../useRelationshipBlock';

const mockInvoke = vi.fn();

vi.mock('@worldwiki/components', () => ({
  invoke: (cmd: string, args: unknown) => mockInvoke(cmd, args),
  processIds: (data: unknown) => data,
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
  },
}));

describe('useRelationshipBlock', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      project: 'p1',
      entityType: 'character',
      entityId: 'char_1',
      item: {
        target_char: '',
        role: 'Friend',
        custom_dynamics: [{ foreign_id: 'dyn_1' }],
      },
      templateConf: {
        bidirectionalLinkClass: 'target_char',
        dataPath: 'custom_dynamics',
        fields: [
          { class: 'target_char', entityType: 'character' },
          { class: 'role', value: '' },
        ],
        fieldOverrides: {
          role: { label: 'Custom Role' },
        },
      },
      allTemplates: {},
      referenceData: {
        character: [
          { value: 'char_1', label: 'Arthur' },
          { value: 'char_2', label: 'Merlin' },
        ],
      },
      sandboxMode: false,
    };
  });

  it('computes labels and resolved fields with all fallbacks', () => {
    props.item.target_char = 'char_2';
    const rel = useRelationshipBlock(props, emit);

    expect(rel.linkClass.value).toBe('target_char');
    expect(rel.myLabel.value).toBe('Arthur');
    expect(rel.foreignLabel.value).toBe('Merlin');

    const fields = rel.getResolvedFields();
    expect(fields.length).toBe(2);
    expect(fields[1].label).toBe('Custom Role');
  });

  it('computes labels when linkClass is inferred from fields', () => {
    props.templateConf.bidirectionalLinkClass = undefined;
    props.templateConf.fields = [
      { class: 'target_select', type: 'select', entityType: 'character' },
    ];
    props.item.target_select = 'char_1';
    props.referenceData = {
      character_list: [{ id: 'char_1', name: 'Arthur Name' }],
    };

    const rel = useRelationshipBlock(props, emit);
    expect(rel.linkClass.value).toBe('target_select');
    expect(rel.myLabel.value).toBe('Arthur Name');
  });

  it('computes labels when linkClass is first select without entityType', () => {
    props.templateConf.bidirectionalLinkClass = undefined;
    props.templateConf.fields = [
      { class: 'generic_select', type: 'select' },
    ];
    props.item.generic_select = 'char_1';
    props.referenceData = {};

    const rel = useRelationshipBlock(props, emit);
    expect(rel.linkClass.value).toBe('generic_select');
    expect(rel.myLabel.value).toBe('char_1');
    expect(rel.foreignLabel.value).toBe('char_1');
  });

  it('falls back to first field if no select found', () => {
    props.templateConf.bidirectionalLinkClass = undefined;
    props.templateConf.fields = [{ class: 'text_field', type: 'text' }];

    const rel = useRelationshipBlock(props, emit);
    expect(rel.linkClass.value).toBe('text_field');
  });

  it('handles field overrides with hidden and custom fields', () => {
    const subConf = {
      fields: [
        { class: 'f1', label: 'Field 1' },
        { class: 'f2', label: 'Field 2' },
      ],
      fieldOverrides: {
        f1: { label: 'Overridden 1' },
        f2: { hidden: true },
      },
    };

    const rel = useRelationshipBlock(props, emit);
    const resolved = rel.getResolvedFields(subConf);

    expect(resolved.length).toBe(1);
    expect(resolved[0].label).toBe('Overridden 1');
  });

  it('handles nested lists manipulations', () => {
    const rel = useRelationshipBlock(props, emit);

    const list = rel.getNestedList();
    expect(list.length).toBe(1);

    rel.addNestedItem();
    expect(props.item.custom_dynamics.length).toBe(2);
    expect(emit).toHaveBeenCalledWith('modified');

    rel.removeNestedItem(0);
    expect(props.item.custom_dynamics.length).toBe(1);
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('updates item field and triggers load foreign item', async () => {
    mockInvoke.mockResolvedValueOnce({
      id: 'char_2',
      data: {
        custom_dynamics: [{ target_char: 'char_1', role: 'Hero' }],
      },
    });

    const rel = useRelationshipBlock(props, emit);
    rel.updateItemField('target_char', 'char_2');

    expect(props.item.target_char).toBe('char_2');
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('updates foreign fields and nested fields', () => {
    const rel = useRelationshipBlock(props, emit);
    rel.foreignItem.value = { title: 'Test', nested: [{ tag: 'old' }] };

    rel.updateForeignField('title', 'Updated');
    expect((rel.foreignItem.value as any).title).toBe('Updated');
    expect(emit).toHaveBeenCalledWith('modified');

    const nested = (rel.foreignItem.value as any).nested as Array<{ tag: string }>;
    rel.updateForeignNestedField(nested[0], 'tag', 'new');
    expect(nested[0].tag).toBe('new');
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('loads foreign item correctly', async () => {
    mockInvoke.mockResolvedValueOnce({
      id: 'char_2',
      data: {
        characterRelationships: [
          { target_char: 'char_1', role: 'Student' },
        ],
      },
    });

    const rel = useRelationshipBlock(props, emit);
    await rel.onLinkChange('target_char')({ target: { value: 'char_2' } } as any);

    expect(mockInvoke).toHaveBeenCalledWith('get_entity', { id: 'char_2' });
    expect(rel.foreignItem.value).toBeDefined();
    expect(rel.foreignItem.value?.role).toBe('Student');
  });

  it('handles sandbox mode for foreign item', async () => {
    props.sandboxMode = true;
    props.item.target_char = 'char_sandbox';

    const rel = useRelationshipBlock(props, emit);
    await rel.onLinkChange('target_char')({ target: { value: 'char_sandbox' } } as any);

    expect(rel.foreignItem.value).toEqual({
      target_char: 'char_1',
      динамика_отношений: [],
    });
  });

  it('handles makeSelectHandler and notifyNestedItemUpdate', () => {
    const rel = useRelationshipBlock(props, emit);

    const handler = rel.makeSelectHandler(0);
    handler({ target: { value: 'dyn_2' } } as any);
    expect(props.item.custom_dynamics[0].foreign_id).toBe('dyn_2');
    expect(emit).toHaveBeenCalledWith('modified');

    rel.notifyNestedItemUpdate('custom_dynamics');
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('handles getOptions and getDynamicContainerFields', () => {
    props.allTemplates = {
      dyn_tpl: { fields: [{ class: 'f1', label: 'Field 1' }] },
    };
    props.referenceData.character_list = [{ value: 'c1', label: 'C1' }];
    const rel = useRelationshipBlock(props, emit);

    // Static options
    expect(rel.getOptions({ class: 'static_f', options: [{ value: '1', label: '1' }] } as any)).toEqual([{ value: '1', label: '1' }]);

    // EntityType referenceData
    expect(rel.getOptions({ class: 'char_f', entityType: 'character' } as any)).toEqual([{ value: 'c1', label: 'C1' }]);

    // Empty fallback
    expect(rel.getOptions({ class: 'plain_f' } as any)).toEqual([]);

    // getDynamicContainerFields
    expect(rel.getDynamicContainerFields({ fields: [{ class: 'f0' }] })).toEqual([{ class: 'f0' }]);
    expect(rel.getDynamicContainerFields({ template: 'dyn_tpl' })).toEqual([{ class: 'f1', label: 'Field 1' }]);
    expect(rel.getDynamicContainerFields({})).toEqual([]);
  });

  it('creates default matched object when foreign entity has no prior relation', async () => {
    props.templateConf.dynamicContainers = [{ id: 'dynamics', dataPath: 'dynamics' }];
    mockInvoke.mockResolvedValueOnce({
      id: 'char_empty',
      data: { characterRelationships: [] },
    });

    const rel = useRelationshipBlock(props, emit);
    await rel.onLinkChange('target_char')({ target: { value: 'char_empty' } } as any);

    expect(rel.foreignItem.value).toBeDefined();
    expect(rel.foreignItem.value?.target_char).toBe('char_1');
    expect(rel.foreignItem.value?.dynamics).toEqual([]);
  });

  it('handles foreign load errors gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));

    const rel = useRelationshipBlock(props, emit);
    await rel.onLinkChange('target_char')({ target: { value: 'char_err' } } as any);

    expect(rel.foreignError.value).toContain('Ошибка загрузки');
    expect(rel.foreignLoading.value).toBe(false);
  });

  describe('Additional branch edge cases for useRelationshipBlock', () => {
    it('handles empty targetId reset, direct referenceData type, and add/removeNestedItem branches', async () => {
      props.item.target_char = '';
      props.referenceData = { fraction: [{ value: 'f1', label: 'Fraction 1' }] };

      const rel = useRelationshipBlock(props, emit);

      // 1. empty targetId reset
      await rel.onLinkChange('target_char')({ target: { value: '' } } as any);
      expect(rel.foreignItem.value).toBeNull();

      // 1b. fetchForeignItem direct call
      props.item.target_char = '';
      await rel.fetchForeignItem();
      expect(rel.foreignItem.value).toBeNull();

      props.item.target_char = 'char_2';
      mockInvoke.mockResolvedValueOnce({
        id: 'char_2',
        data: { characterRelationships: [{ target_char: 'char_1', role: 'Partner' }] },
      });
      await rel.fetchForeignItem();
      expect(rel.foreignItem.value?.role).toBe('Partner');

      // 2. getOptions with direct type match without _list suffix and foreign_type fallback
      expect(rel.getOptions({ class: 'frac', entityType: 'fraction' } as any)).toEqual([{ value: 'f1', label: 'Fraction 1' }]);
      props.templateConf.foreign_type = 'fraction';
      expect(rel.getOptions({ class: 'plain' } as any)).toEqual([{ value: 'f1', label: 'Fraction 1' }]);

      // 3. addNestedItem passing Event instance
      rel.addNestedItem(new Event('click') as any, { fields: [{ class: 'role', value: 'Hero' }] });
      expect(emit).toHaveBeenCalledWith('modified');

      // 4. removeNestedItem on valid array and invalid non-array
      rel.removeNestedItem(0);
      expect(emit).toHaveBeenCalledWith('modified');

      rel.removeNestedItem(0, {}, { dataPath: 'missing_path' });
    });

    it('uses second find (strip prefix) when direct match fails (line 144-147)', async () => {
      // entity stored as 'entities:char_1' in relArray, but entityId is bare 'char_1'
      props.entityId = 'char_1';
      mockInvoke.mockResolvedValueOnce({
        id: 'char_2',
        data: {
          customRelations: [
            { target_char: 'entities:char_1', role: 'Enemy' }, // prefixed ID
          ],
        },
      });

      props.templateConf.dynamicContainers = [{ id: 'customRelations', dataPath: 'customRelations' }];
      const rel = useRelationshipBlock(props, emit);
      await rel.onLinkChange('target_char')({ target: { value: 'char_2' } } as any);

      // Should find via rawId strip
      expect(rel.foreignItem.value?.role).toBe('Enemy');
    });

    it('deletes relationshipStates when matched has both динамика_отношений and relationshipStates (line 161)', async () => {
      const rel = useRelationshipBlock(props, emit);

      // Manually set foreignItem to trigger the watcher branch
      rel.foreignItem.value = {
        target_char: 'char_2',
        семейные_отношения: [{ rel: 'sister' }],
        familyRelationshipStates: { 'char_2': 'active' },
        динамика_отношений: [{ stage: 1 }],
        relationshipStates: { 'char_1': 'active' },
      };
      rel.foreignModified.value = true;

      // Wait for watcher to fire
      await new Promise(r => setTimeout(r, 0));
      expect(emit).toHaveBeenCalledWith('foreign-update', expect.any(Object));
    });

    it('getResolvedFields via template in allTemplates (line 19)', () => {
      props.allTemplates = {
        tpl_resolved: { fields: [{ class: 'role', label: 'Role from Template' }] },
      };
      const rel = useRelationshipBlock(props, emit);
      const fields = rel.getResolvedFields({ template: 'tpl_resolved' });
      expect(fields[0].label).toBe('Role from Template');
    });

    it('deletes relationshipStates during matched initialization when dynamicContainers contain both (line 161)', async () => {
      props.templateConf.dynamicContainers = [
        { id: 'динамика_отношений' },
        { id: 'relationshipStates' },
      ];
      mockInvoke.mockResolvedValueOnce({
        id: 'char_empty',
        data: {}, // no characterRelationships
      });

      const rel = useRelationshipBlock(props, emit);
      await rel.onLinkChange('target_char')({ target: { value: 'char_empty' } } as any);

      expect(rel.foreignItem.value).toBeDefined();
      expect(rel.foreignItem.value?.['динамика_отношений']).toEqual([]);
      expect(rel.foreignItem.value?.['relationshipStates']).toBeUndefined();
    });

    it('addNestedItem via subConf template in allTemplates (line 242)', () => {
      props.allTemplates = {
        tpl_nested: { fields: [{ class: 'dyn_class', value: 'def_val' }, { class: 'no_val' }] },
      };
      const rel = useRelationshipBlock(props, emit);

      props.item.foreign_ids = undefined;
      rel.addNestedItem(undefined, { template: 'tpl_nested', id: 'foreign_ids' });

      expect(props.item.foreign_ids.length).toBe(1);
      expect(props.item.foreign_ids[0].dyn_class).toBe('def_val');
      expect(props.item.foreign_ids[0].no_val).toBe('');
      expect(emit).toHaveBeenCalledWith('modified');
    });

    it('inherits end chapter of previous block into start and end of new block', () => {
      const rel = useRelationshipBlock(props, emit);
      props.item.dynamics = [
        {
          начальная_глава: { volume_id: 'v1', chapter_id: 'c1' },
          конечная_глава: { volume_id: 'v1', chapter_id: 'c5', is_auto_extend: true }
        }
      ];

      rel.addNestedItem(undefined, { id: 'dynamics' });

      expect(props.item.dynamics.length).toBe(2);
      expect(props.item.dynamics[0].конечная_глава.is_auto_extend).toBe(false);
      expect(props.item.dynamics[1].начальная_глава).toEqual({
        volume_id: 'v1', chapter_id: 'c5', is_auto_extend: false
      });
      expect(props.item.dynamics[1].конечная_глава).toEqual({
        volume_id: 'v1', chapter_id: 'c5', is_auto_extend: true
      });
    });

    it('covers makeSelectHandler, notifyNestedItemUpdate, getDynamicContainerFields, and hidden fieldOverrides', () => {
      props.allTemplates = {
        tpl_dyn: { fields: [{ class: 'field_dyn', label: 'Field Dyn' }] },
      };
      const rel = useRelationshipBlock(props, emit);

      // 1. makeSelectHandler with valid index and list
      props.item.custom_dynamics = [{ foreign_id: 'old_id' }];
      const handler = rel.makeSelectHandler(0);
      handler({ target: { value: 'new_id' } } as any);
      expect(props.item.custom_dynamics[0].foreign_id).toBe('new_id');
      expect(emit).toHaveBeenCalledWith('item-updated', { item: props.item, idx: undefined });
      expect(emit).toHaveBeenCalledWith('modified');

      // 2. makeSelectHandler with out of bounds index or missing list
      const outOfBoundsHandler = rel.makeSelectHandler(99);
      outOfBoundsHandler({ target: { value: 'none' } } as any);

      const missingListHandler = rel.makeSelectHandler(0, { id: 'non_existent_list' });
      missingListHandler({ target: { value: 'none' } } as any);

      // 3. notifyNestedItemUpdate with and without path
      rel.notifyNestedItemUpdate();
      rel.notifyNestedItemUpdate('custom_path');
      expect(emit).toHaveBeenCalledWith('item-updated', { item: props.item, idx: undefined });

      // 4. getDynamicContainerFields
      expect(rel.getDynamicContainerFields(undefined as any)).toEqual([]);
      expect(rel.getDynamicContainerFields({ fields: [{ class: 'direct_field' }] })).toEqual([{ class: 'direct_field' }]);
      expect(rel.getDynamicContainerFields({ template: 'tpl_dyn' })).toEqual([{ class: 'field_dyn', label: 'Field Dyn' }]);
      expect(rel.getDynamicContainerFields({ template: 'unknown_tpl' })).toEqual([]);

      // 5. getResolvedFields with hidden override
      const relHidden = useRelationshipBlock({
        ...props,
        templateConf: {
          fields: [
            { class: 'visible_field', label: 'Visible' },
            { class: 'hidden_field', label: 'Hidden' },
          ],
          fieldOverrides: {
            hidden_field: { hidden: true },
          },
        },
      }, emit);
      const resolved = relHidden.getResolvedFields();
      expect(resolved.length).toBe(1);
      expect(resolved[0].class).toBe('visible_field');

      // 6. addNestedItem with number field type
      rel.addNestedItem(undefined, {
        id: 'num_list',
        fields: [{ class: 'count', type: 'number' }, { class: 'tag', type: 'text' }],
      });
      expect(props.item.num_list[0].count).toBe(0);
      expect(props.item.num_list[0].tag).toBe('');

      // 7. removeNestedItem with missing path or missing item[path]
      rel.removeNestedItem(0, { no_path: true }, { id: '' } as any);
      rel.removeNestedItem(0, { uninitialized: {} }, { id: 'missing_prop' });

      // 8. updateItemField and onSelectChange branches
      rel.updateItemField('target_char', 'char_3');
      expect(emit).toHaveBeenCalledWith('modified');
      rel.updateItemField('target_char', null);
      expect(rel.foreignItem.value).toBeNull();
      rel.onSelectChange('role', 'Leader');
      expect(props.item.role).toBe('Leader');
    });

    it('covers foreignItemLabel fallback and getTargetForeignId watcher', async () => {
      const reactiveProps = reactive({
        ...props,
        item: { target_char: 'unknown_foreign_id' },
        referenceData: { characters: [{ value: 'other_id', label: 'Other' }] },
      });

      const rel = useRelationshipBlock(reactiveProps as any, emit);
      expect(rel.foreignLabel.value).toBe('unknown_foreign_id');

      // Watcher: change target_char to newTargetId
      mockInvoke.mockResolvedValueOnce({ id: 'char_watch', data: {} });
      reactiveProps.item.target_char = 'char_watch';
      await nextTick();
      expect(mockInvoke).toHaveBeenCalledWith('get_entity', { id: 'char_watch' });

      // Watcher: change target_char to empty
      reactiveProps.item.target_char = '';
      await nextTick();
      expect(rel.foreignItem.value).toBeNull();
    });
  });
});
