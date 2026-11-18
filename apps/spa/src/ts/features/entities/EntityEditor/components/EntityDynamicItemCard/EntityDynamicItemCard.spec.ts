import { describe, it, expect, vi } from 'vitest';
import { useEntityDynamicItemCard } from './useEntityDynamicItemCard';

describe('useEntityDynamicItemCard', () => {
  it('computes isCollapsed and itemSummary properly and handles updates', () => {
    const item = { title: 'Chapter Item' };
    const container = { id: 'c1', dataPath: 'events' };
    const emit = vi.fn();
    const props = {
      item,
      idx: 0,
      container,
      project: 'p1',
      isItemCollapsed: vi.fn((path, idx) => idx === 0),
      getItemSummary: vi.fn(() => 'Summary'),
      getResolvedTemplate: vi.fn(() => ({ fields: [{ id: 'f1', label: 'Field 1' }] } as any)),
      getProp: vi.fn((obj, path) => (obj as any)[path]),
      setProp: vi.fn((obj, path, val) => {
        (obj as any)[path] = val;
      }),
      getOptionsFor: vi.fn(() => []),
      isChapterField: vi.fn(() => false),
    };

    const card = useEntityDynamicItemCard(props as any, emit);

    expect(card.containerPath.value).toBe('events');
    expect(card.isCollapsed.value).toBe(true);
    expect(card.itemSummary.value).toBe('Summary');
    expect(card.templateFields.value).toHaveLength(1);

    card.toggleCollapse();
    expect(emit).toHaveBeenCalledWith('toggleCollapse', 'events', 0);

    card.remove();
    expect(emit).toHaveBeenCalledWith('remove', 'events', 0);

    card.updateProp('f1', 'new val');
    expect(props.setProp).toHaveBeenCalledWith(item, 'f1', 'new val');
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('covers multiselect, inputs, ongoing checks/toggles, and field hiding', async () => {
    const { reactive } = await import('vue');
    const item: Record<string, unknown> = reactive({
      tags: ['a'],
      dateObj: { ongoing: true },
      dateAbs: { m_abs: 100 },
      _hiddenFields: ['f2'],
    });
    const emit = vi.fn();
    const props = {
      item,
      idx: 0,
      container: { id: 'c1', dataPath: 'events' },
      project: 'p1',
      isItemCollapsed: vi.fn(() => false),
      getItemSummary: vi.fn(() => ''),
      getResolvedTemplate: vi.fn(() => null),
      getProp: vi.fn((obj: Record<string, unknown>, path: string) => obj[path]),
      setProp: vi.fn((obj: Record<string, unknown>, path: string, val: unknown) => {
        obj[path] = val;
      }),
      getOptionsFor: vi.fn(() => []),
      isChapterField: vi.fn(() => false),
    };

    const card = useEntityDynamicItemCard(props as never, emit);

    card.onMultiselectToggle('tags', 'b', true);
    expect(item.tags).toEqual(['a', 'b']);
    expect(card.isMultiselectChecked('tags', 'b')).toBe(true);
    card.onMultiselectToggle('tags', 'b', false);
    expect(item.tags).toEqual(['a']);

    expect(card.getFieldValue('missing')).toBe('');
    expect(card.getFieldProp('tags')).toEqual(['a']);

    card.onTextareaInput('bio', { target: { value: 'txt' } } as unknown as Event);
    card.onTextInput('title', { target: { value: 't' } } as unknown as Event);
    card.onNumberInput('age', { target: { value: '42' } } as unknown as Event);
    card.onCheckboxChange('tags', 'c', { target: { checked: true } } as unknown as Event);
    expect(item.age).toBe(42);
    expect(item.tags).toEqual(['a', 'c']);

    expect(card.isFieldOngoing('missing')).toBe(true);
    expect(card.isFieldOngoing('dateObj')).toBe(true);
    expect(card.isFieldOngoing('dateAbs')).toBe(false);
    expect(card.isFieldOngoing('title')).toBe(false);

    card.toggleFieldOngoing('dateObj', { target: { checked: true } } as unknown as Event);
    expect(item.dateObj).toBeNull();
    card.toggleFieldOngoing('dateObj', { target: { checked: false } } as unknown as Event);
    expect(item.dateObj).toEqual({ ongoing: false });

    expect(card.isFieldHidden('f2')).toBe(true);
    expect(card.canHideField({ class: 'глава' } as never)).toBe(true);
    expect(card.canHideField({ required: true } as never)).toBe(false);
    expect(card.canHideField({ id: 'opt' } as never)).toBe(true);
    card.hideField('f3');
    expect(item._hiddenFields).toEqual(['f2', 'f3']);
    card.unhideField('f2');
    expect(item._hiddenFields).toEqual(['f3']);
  });
});

