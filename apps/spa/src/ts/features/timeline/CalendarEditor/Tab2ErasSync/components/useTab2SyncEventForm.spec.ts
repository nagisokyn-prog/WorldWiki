import { describe, it, expect } from 'vitest';
import { useTab2SyncEventForm } from './useTab2SyncEventForm';
import type { Tab2SyncEventFormProps } from './Tab2SyncEventForm.model';

describe('useTab2SyncEventForm', () => {
  const props: Tab2SyncEventFormProps = {
    selectedEventId: 'ev_1',
    anchorEvents: [
      { id: 'ev_1', name: 'Падение Крепости', year: 500 },
      { id: 'ev_2', name: 'Великий Поход', year: 750 },
    ],
    currentEvent: undefined,
    offsetDirection: 'after',
    offsetYears: 5,
  };

  it('computes eventOptions properly from anchorEvents', () => {
    const { eventOptions } = useTab2SyncEventForm(props);
    expect(eventOptions.value).toHaveLength(2);
    expect(eventOptions.value[0]).toEqual({
      value: 'ev_1',
      label: 'Падение Крепости (Год 500)',
    });
    expect(eventOptions.value[1]).toEqual({
      value: 'ev_2',
      label: 'Великий Поход (Год 750)',
    });
  });
});
