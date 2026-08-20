import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRelationshipBlock } from '../useRelationshipBlock';
import { entityApi } from '../entity.api';

vi.mock('../entity.api', () => ({
  entityApi: {
    getEntity: vi.fn(),
  },
}));

vi.mock('@worldwiki/components', () => ({
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
        target_char: 'char_2',
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
    const rel = useRelationshipBlock(props, emit);

    expect(rel.linkClass.value).toBe('target_char');
    expect(rel.myLabel.value).toBe('Arthur');
    expect(rel.foreignLabel.value).toBe('Merlin');

    const fields = rel.getResolvedFields();
    expect(fields.find((f: any) => f.class === 'role')?.label).toBe('Custom Role');

    // 1. linkClass fallback branches
    // a. No bidirectionalLinkClass, has select field with entityType
    const relSelect = useRelationshipBlock({
      ...props,
      templateConf: { fields: [{ class: 'custom_link', type: 'select', entityType: 'char' }] },
    }, emit);
    expect(relSelect.linkClass.value).toBe('custom_link');

    // b. No bidirectionalLinkClass, fields has no select with entityType
    const relNoLink = useRelationshipBlock({
      ...props,
      templateConf: { fields: [{ class: 'other_field', type: 'text' }] },
    }, emit);
    expect(relNoLink.linkClass.value).toBe('character');

    // c. No fields at all
    const relEmptyConf = useRelationshipBlock({ ...props, templateConf: {} }, emit);
    expect(relEmptyConf.linkClass.value).toBe('character');

    // 2. myLabel fallbacks: missing referenceData, unknown ID, empty entityId
    const relUnknownMy = useRelationshipBlock({ ...props, entityId: 'unknown_id', referenceData: {} }, emit);
    expect(relUnknownMy.myLabel.value).toBe('unknown_id');

    const relEmptyMy = useRelationshipBlock({ ...props, entityId: '', referenceData: {} }, emit);
    expect(relEmptyMy.myLabel.value).toBe('Текущая сущность');

    // 3. foreignLabel fallbacks: empty foreignId, missing targetType, missing in refList
    const relNoForeign = useRelationshipBlock({ ...props, item: {} }, emit);
    expect(relNoForeign.foreignLabel.value).toBe('Не выбрано');

    const relUnknownForeign = useRelationshipBlock({
      ...props,
      item: { target_char: 'unknown_foreign' },
      templateConf: { bidirectionalLinkClass: 'target_char' }, // no fields with entityType and no foreign_type
      referenceData: {},
    }, emit);
    expect(relUnknownForeign.foreignLabel.value).toBe('unknown_foreign');
  });

  it('handles item updates and select changes', () => {
    const rel = useRelationshipBlock(props, emit);

    rel.onSelectChange('role', 'Mentor');
    expect(props.item.role).toBe('Mentor');
    expect(emit).toHaveBeenCalledWith('modified');

    rel.updateItemField('role', 'Brother');
    expect(props.item.role).toBe('Brother');
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('manages nested list additions and removals', () => {
    props.templateConf.fields = [{ class: 'foreign_id', value: 'def_val' }];
    const rel = useRelationshipBlock(props, emit);

    expect(rel.getNestedList().length).toBe(1);

    rel.addNestedItem();
    expect(rel.getNestedList().length).toBe(2);
    expect(emit).toHaveBeenCalledWith('modified');

    rel.removeNestedItem(0);
    expect(rel.getNestedList().length).toBe(1);
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('loads foreign item correctly', async () => {
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({
      id: 'char_2',
      data: {
        characterRelationships: [
          { target_char: 'char_1', role: 'Student' },
        ],
      },
    } as any);

    const rel = useRelationshipBlock(props, emit);
    await rel.onLinkChange('target_char')({ target: { value: 'char_2' } } as any);

    expect(entityApi.getEntity).toHaveBeenCalledWith('p1', 'character', 'char_2');
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
    vi.mocked(entityApi.getEntity).mockResolvedValueOnce({
      id: 'char_empty',
      data: { characterRelationships: [] },
    } as any);

    const rel = useRelationshipBlock(props, emit);
    await rel.onLinkChange('target_char')({ target: { value: 'char_empty' } } as any);

    expect(rel.foreignItem.value).toBeDefined();
    expect(rel.foreignItem.value?.target_char).toBe('char_1');
    expect(rel.foreignItem.value?.dynamics).toEqual([]);
  });

  it('handles foreign load errors gracefully', async () => {
    vi.mocked(entityApi.getEntity).mockRejectedValueOnce(new Error('Network error'));

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
      vi.mocked(entityApi.getEntity).mockResolvedValueOnce({
        id: 'char_2',
        data: { characterRelationships: [{ target_char: 'char_1', role: 'Partner' }] },
      } as any);
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
      vi.mocked(entityApi.getEntity).mockResolvedValueOnce({
        id: 'char_2',
        data: {
          customRelations: [
            { target_char: 'entities:char_1', role: 'Enemy' }, // prefixed ID
          ],
        },
      } as any);

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
      vi.mocked(entityApi.getEntity).mockResolvedValueOnce({
        id: 'char_empty',
        data: {}, // no characterRelationships
      } as any);

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
  });
});
