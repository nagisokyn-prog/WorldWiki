import { describe, it, expect, beforeEach } from 'vitest';
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

  it('handles palette drag and drop for module', () => {
    const dnd = useSchemaDnD(activeSection, activeSectionIdx);
    const event = { dataTransfer: { effectAllowed: '', setData: () => {} } } as any;

    dnd.handleDragStartPalette(event, 'module', 'timelineEvents', 'Timeline');
    dnd.handleDropNew(event);

    expect(activeSection.value.items.length).toBe(3);
    expect(activeSection.value.items[2].template).toBe('timelineEvents');
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
});
