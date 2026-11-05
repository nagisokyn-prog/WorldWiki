import { describe, it, expect, vi } from 'vitest';
import { useTab2AnchorEventsSection } from './useTab2AnchorEventsSection';
import type { Tab2AnchorEventsSectionProps } from './Tab2AnchorEventsSection.model';

describe('useTab2AnchorEventsSection', () => {
  const props: Tab2AnchorEventsSectionProps = {
    anchorEvents: [
      { id: 'ev_1', name: 'Битва у Древа', year: 100, month: 2, day: 15, description: 'Великая битва' },
    ],
  };

  it('handles field change and emits update', () => {
    const emit = vi.fn();
    const { onFieldChange } = useTab2AnchorEventsSection(props, emit as any);

    onFieldChange(0, 'name', 'Новое название');
    expect(emit).toHaveBeenCalledWith('update-anchor-event', 0, {
      id: 'ev_1',
      name: 'Новое название',
      year: 100,
      month: 2,
      day: 15,
      description: 'Великая битва',
    });
  });

  it('submits new event and emits add', () => {
    const emit = vi.fn();
    const {
      newEventName,
      newEventYear,
      newEventMonth,
      newEventDay,
      newEventDesc,
      submitNewEvent,
      showAddRow,
    } = useTab2AnchorEventsSection(props, emit as any);

    showAddRow.value = true;
    newEventName.value = 'Основание Города';
    newEventYear.value = 50;
    newEventMonth.value = 5;
    newEventDay.value = 10;
    newEventDesc.value = 'Постройка первых стен';

    submitNewEvent();

    expect(emit).toHaveBeenCalledWith('add-anchor-event', expect.objectContaining({
      name: 'Основание Города',
      year: 50,
      month: 4,
      day: 10,
      description: 'Постройка первых стен',
    }));
    expect(showAddRow.value).toBe(false);
  });
});

