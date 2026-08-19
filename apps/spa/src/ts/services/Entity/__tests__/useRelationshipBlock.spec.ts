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

  it('computes labels and resolved fields', () => {
    const rel = useRelationshipBlock(props, emit);

    expect(rel.linkClass.value).toBe('target_char');
    expect(rel.myLabel.value).toBe('Arthur');
    expect(rel.foreignLabel.value).toBe('Merlin');

    const fields = rel.getResolvedFields();
    expect(fields.find((f: any) => f.class === 'role').label).toBe('Custom Role');
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
    expect(rel.foreignItem.value.role).toBe('Student');
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
});
