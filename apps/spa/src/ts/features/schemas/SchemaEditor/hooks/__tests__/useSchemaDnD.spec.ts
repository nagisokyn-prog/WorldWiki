import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useSchemaDnD } from '../useSchemaDnD';

describe('useSchemaDnD', () => {
  let activeSection: any;
  let activeSectionIdx: any;

  beforeEach(() => {
    activeSection = ref({
      items: [
        { type: 'text', class: 'name', label: 'NAME' },
        { type: 'textarea', class: 'bio', label: 'BIO' },
      ],
    });
    activeSectionIdx = ref(0);
  });

  it('handles palette drag and drop for atomic field', () => {
    const dnd = useSchemaDnD(activeSection, activeSectionIdx);
    const event = { dataTransfer: { effectAllowed: '', setData: () => {} } } as any;

    dnd.handleDragStartPalette(event, 'atomic', 'number', 'Age');
    dnd.handleDropNew(event);

    expect(activeSection.value.items.length).toBe(3);
    expect(activeSection.value.items[2].type).toBe('number');
  });

  it('handles palette drag and drop for module with and without timeline in template', () => {
    const dnd = useSchemaDnD(activeSection, activeSectionIdx);
    const event = { dataTransfer: { effectAllowed: '', setData: () => {} } } as any;

    // Timeline template
    dnd.handleDragStartPalette(event, 'module', 'timelineEvents', 'Timeline', 'timelineEvents');
    dnd.handleDropNew(event);

    expect(activeSection.value.items.length).toBe(3);
    expect(activeSection.value.items[2].template).toBe('timelineEvents');
    expect(activeSection.value.items[2].type).toBe('timeline');

    // Non-timeline template
    dnd.handleDragStartPalette(event, 'module', 'chars', 'Chars', 'characters');
    dnd.handleDropNew(event);
    expect(activeSection.value.items.length).toBe(4);
    expect(activeSection.value.items[3].type).toBe('dynamic');
  });

  it('reorders canvas items via item drop', () => {
    const dnd = useSchemaDnD(activeSection, activeSectionIdx);
    const event = { dataTransfer: { effectAllowed: '', setData: () => {} }, preventDefault: () => {} } as any;

    // Drag item 1 (bio)
    dnd.handleItemDragStart(event, 1);
    dnd.handleItemDrop(1);

    expect(activeSection.value.items.length).toBe(2);
  });

  it('drops atomic field into a module container', () => {
    activeSection.value.items.push({
      id: 'mod1',
      customFields: [],
    });

    const dnd = useSchemaDnD(activeSection, activeSectionIdx);
    const event = { dataTransfer: { effectAllowed: '', setData: () => {} } } as any;

    dnd.handleDragStartPalette(event, 'atomic', 'text', 'Custom Label');
    dnd.handleDropIntoModule(2);

    expect(activeSection.value.items[2].customFields.length).toBe(1);
    expect(activeSection.value.items[2].customFields[0].label).toBe('CUSTOM LABEL');
  });

  describe('Additional branch edge cases for useSchemaDnD', () => {
    it('prevents dragging the first title item in the first section', () => {
      const dnd = useSchemaDnD(activeSection, activeSectionIdx);
      const preventDefault = vi.fn();
      const event = { dataTransfer: { effectAllowed: '', setData: () => {} }, preventDefault } as any;

      dnd.handleItemDragStart(event, 0); // idx = 0 in section 0
      expect(preventDefault).toHaveBeenCalled();
    });

    it('sets dropEffect in handleDragOverCanvas for palette vs canvas sources', () => {
      const dnd = useSchemaDnD(activeSection, activeSectionIdx);
      const dt = { effectAllowed: '', setData: () => {}, dropEffect: '' };
      const event = { dataTransfer: dt, preventDefault: () => {} } as any;

      // Palette source
      dnd.handleDragStartPalette(event, 'atomic', 'text', 'Label');
      dnd.handleDragOverCanvas(event);
      expect(dt.dropEffect).toBe('copy');

      // Canvas source
      activeSectionIdx.value = 1;
      dnd.handleItemDragStart(event, 0);
      dnd.handleDragOverCanvas(event);
      expect(dt.dropEffect).toBe('move');
    });

    it('handles null draggedItemInfo early return in drop handlers', () => {
      const dnd = useSchemaDnD(activeSection, activeSectionIdx);
      const event = { dataTransfer: null } as any;

      dnd.handleDropNew(event);
      dnd.handleItemDrop(0);
      dnd.handleDropIntoModule(0);
      expect(activeSection.value.items.length).toBe(2);
    });

    it('handles handleItemDrop for palette atomic, timeline module, and canvas reorders', () => {
      const dnd = useSchemaDnD(activeSection, activeSectionIdx);
      const event = { dataTransfer: { effectAllowed: '', setData: () => {} }, preventDefault: () => {} } as any;

      // Drop palette atomic at specific target index
      dnd.handleDragStartPalette(event, 'atomic', 'boolean', 'Checkbox');
      dnd.handleItemDrop(1);
      expect(activeSection.value.items[1].type).toBe('boolean');

      // Drop palette timeline module at specific target index
      dnd.handleDragStartPalette(event, 'module', 'timelineList', 'Timeline Module', 'timeline_tpl');
      dnd.handleItemDrop(2);
      expect(activeSection.value.items[2].type).toBe('timeline');

      // Drop palette dynamic module at specific target index
      dnd.handleDragStartPalette(event, 'module', 'characters', 'Chars');
      dnd.handleItemDrop(2);
      expect(activeSection.value.items[2].type).toBe('dynamic');

      // Reorder canvas items (move from idx 2 to idx 0 in section > 0)
      activeSectionIdx.value = 1;
      dnd.handleItemDragStart(event, 2);
      dnd.handleItemDrop(0);
      expect(activeSection.value.items.length).toBe(5);

      // Reorder from idx 0 to idx 2 (srcIdx < targetIdx)
      dnd.handleItemDragStart(event, 0);
      dnd.handleItemDrop(2);

      // Guard: targetIdx 0 in activeSectionIdx 0 (cannot drop onto title)
      activeSectionIdx.value = 0;
      dnd.handleDragStartPalette(event, 'atomic', 'text', 'T');
      dnd.handleItemDrop(0);
    });

    it('handles missing items array in section for drop handlers', () => {
      const emptySection = ref({} as any);
      const dnd = useSchemaDnD(emptySection, activeSectionIdx);
      const event = { dataTransfer: { effectAllowed: '', setData: () => {} } } as any;

      // handleDropNew with uninitialized items
      dnd.handleDragStartPalette(event, 'atomic', 'text', 'My Field');
      dnd.handleDropNew(event);
      expect(emptySection.value.items.length).toBe(1);

      // handleItemDrop with uninitialized items
      emptySection.value.items = undefined as any;
      activeSectionIdx.value = 1;
      dnd.handleDragStartPalette(event, 'atomic', 'number', 'Num');
      dnd.handleItemDrop(0);
      expect(emptySection.value.items.length).toBe(1);
    });

    it('initializes customFields if undefined, and ignores non-atomic or missing module in handleDropIntoModule', () => {
      activeSection.value.items.push({
        id: 'mod_no_fields',
      }); // no customFields property

      const dnd = useSchemaDnD(activeSection, activeSectionIdx);
      const event = { dataTransfer: { effectAllowed: '', setData: () => {} } } as any;

      // Drop atomic into module
      dnd.handleDragStartPalette(event, 'atomic', 'select', 'Dropdown');
      dnd.handleDropIntoModule(2);

      expect(activeSection.value.items[2].customFields).toBeDefined();
      expect(activeSection.value.items[2].customFields.length).toBe(1);

      // Drop into non-existent module index
      dnd.handleDragStartPalette(event, 'atomic', 'text', 'Label');
      dnd.handleDropIntoModule(999);

      // Drop module into module (ignored)
      dnd.handleDragStartPalette(event, 'module', 'mod', 'Mod');
      dnd.handleDropIntoModule(2);
      expect(activeSection.value.items[2].customFields.length).toBe(1);
    });
  });
});
