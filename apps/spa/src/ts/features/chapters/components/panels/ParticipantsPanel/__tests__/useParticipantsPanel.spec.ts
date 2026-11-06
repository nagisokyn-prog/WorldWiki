import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useParticipantsPanel } from '../useParticipantsPanel';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn().mockResolvedValue([]),
  getSchemas: vi.fn().mockResolvedValue([]),
  getEntitiesBatch: vi.fn().mockResolvedValue({}),
}));

describe('useParticipantsPanel', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      project: 'proj_1',
      participants: [],
    };
  });

  it('loads entities on mount and falls back gracefully when API fails', async () => {
    vi.mocked(api.getEntities).mockRejectedValueOnce(new Error('Fetch failed'));

    let vm: any;
    const TestComp = defineComponent({
      setup() {
        vm = useParticipantsPanel(props, emit);
        return { ...vm };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp);
    await flushPromises();

    expect(api.getEntities).toHaveBeenCalledWith('proj_1', expect.any(String));
    expect(vm.entities.value).toEqual([]);
    wrapper.unmount();
  });

  it('normalizes string participants, handles null/undefined participants', () => {
    props.participants = ['character:char_1', 'plain_id'];
    const panel = useParticipantsPanel(props, emit);

    const norm = panel.normalizedParticipants.value;
    expect(norm.length).toBe(2);
    expect(norm[0].type).toBe('character');
    expect(norm[0].id).toBe('char_1');
    expect(norm[1].type).toBe('entity');
    expect(norm[1].id).toBe('plain_id');

    const emptyPanel = useParticipantsPanel({ project: 'p1', participants: null }, emit);
    expect(emptyPanel.normalizedParticipants.value).toEqual([]);
  });

  it('resolves entity names with various formats, nested objects, and fallbacks in mounted component', async () => {
    vi.mocked(api.getEntities).mockResolvedValueOnce([
      { id: '1', name: 'Direct Name' },
      { id: '2', profile: { full_title: 'Nested Title' } },
      { id: '3', custom: 123 },
    ] as any);

    let panel: any;
    const TestComp = defineComponent({
      setup() {
        panel = useParticipantsPanel(props, emit);
        return { ...panel };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp);
    await flushPromises();

    // Not in list
    expect(panel.resolveEntityName('99999999', 'character')).toBe('ID: 99999999');

    // Direct name
    expect(panel.resolveEntityName('1', 'character')).toBe('Direct Name');

    // Nested name
    expect(panel.resolveEntityName('2', 'character')).toBe('Nested Title');

    // No matching name keywords
    expect(panel.resolveEntityName('3', 'character')).toBe('Без названия');

    wrapper.unmount();
  });

  it('handles adding participants: empty inputs, duplicate entries, and new entries', () => {
    const panel = useParticipantsPanel(props, emit);

    // Empty ID
    panel.newId.value = '';
    panel.addParticipant();
    expect(emit).not.toHaveBeenCalled();

    // Duplicate participant
    props.participants = [{ type: 'character', id: '1' }];
    panel.newType.value = 'character';
    panel.newId.value = '1';
    panel.addParticipant();
    expect(emit).not.toHaveBeenCalled();

    // New participant
    panel.newType.value = 'character';
    panel.newId.value = '2';
    panel.addParticipant();
    expect(emit).toHaveBeenCalledWith(
      'update:participants',
      expect.arrayContaining([
        expect.objectContaining({ type: 'character', id: '1' }),
        expect.objectContaining({ type: 'character', id: '2' }),
      ])
    );
  });

  it('removes participant and returns icons', () => {
    props.participants = [{ type: 'character', id: '1' }, { type: 'location', id: '2' }];
    const panel = useParticipantsPanel(props, emit);

    panel.removeParticipant(0);
    expect(emit).toHaveBeenCalledWith('update:participants', [
      expect.objectContaining({ type: 'location', id: '2' }),
    ]);

    expect(panel.getIcon('character')).toBeDefined();
    expect(panel.getIcon('organization')).toBeDefined();
    expect(panel.getIcon('location')).toBeDefined();
    expect(panel.getIcon('unknown')).toBeDefined();
  });

  it('handles onMounted rejection and resolveEntityName edge cases', async () => {
    vi.mocked(api.getEntities).mockResolvedValueOnce([
      { id: '10', name: '   ' }, // empty whitespace name
      { id: '11', nested: { name: null, sub: { title: 'Deep Title' } } }, // deep nested name
      { id: '12', nonObj: 123 }, // no name keys
      { id: '13', emptyObj: null, deep: { nothing: 123 } }, // nested object returning null (covers lines 59, 69)
    ] as any);

    let panel: any;
    const TestComp = defineComponent({
      setup() {
        panel = useParticipantsPanel(props, emit);
        return { ...panel };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComp);
    await flushPromises();

    expect(panel.resolveEntityName('10', 'character')).toBe('Без названия');
    expect(panel.resolveEntityName('11', 'character')).toBe('Deep Title');
    expect(panel.resolveEntityName('12', 'character')).toBe('Без названия');
    expect(panel.resolveEntityName('13', 'character')).toBe('Без названия');

    wrapper.unmount();

    // API rejection on mount
    vi.mocked(api.getEntities).mockRejectedValueOnce(new Error('Fetch failed'));
    const wrapperFail = mount(TestComp);
    await flushPromises();
    expect(panel.entities.value).toEqual([]);
    wrapperFail.unmount();

    // Cache hit and null api return
    vi.mocked(api.getEntities).mockResolvedValueOnce(null as any);
    panel.newType.value = 'location';
    await panel.loadEntitiesForType();
    expect(panel.entities.value).toEqual([]);

    // Call loadEntitiesForType again with same type (cache hit branch)
    await panel.loadEntitiesForType();
    expect(panel.entities.value).toEqual([]);
  });
});
