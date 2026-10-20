/**
 * @file Tab2ErasSync.spec.ts
 * @description Unit-тесты для useTab2ErasSync
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab2ErasSync } from './useTab2ErasSync';
import type { Tab2ErasSyncProps, Tab2ErasSyncEmits } from './Tab2ErasSync.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab2ErasSync', () => {
  const mockCalendar: CalendarData = {
    название: 'Календарь Империи',
    is_master: false,
    эпохи: [
      { название: 'Эпоха Пепла', год_начала: 1, год_конца: 500 },
    ],
    anchor_events: [
      { name: 'Основание Города', year: 1, month: 0, day: 1 },
    ],
  };

  it('добавляет и удаляет эру', () => {
    const emit = vi.fn() as unknown as Tab2ErasSyncEmits;
    const { addEra, removeEra } = useTab2ErasSync({ calendarData: mockCalendar }, emit);

    addEra();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      эпохи: expect.arrayContaining([expect.objectContaining({ название: 'Эпоха 2' })]),
    }));

    removeEra(0);
    // При наличии 1 эры удаление не происходит (минимальный инвариант)
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('добавляет и удаляет исторические вехи (Anchor Events)', () => {
    const emit = vi.fn() as unknown as Tab2ErasSyncEmits;
    const { addAnchorEvent, removeAnchorEvent } = useTab2ErasSync({ calendarData: mockCalendar }, emit);

    addAnchorEvent();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      anchor_events: expect.arrayContaining([expect.objectContaining({ year: 1000 })]),
    }));

    removeAnchorEvent(0);
    expect(emit).toHaveBeenCalled();
  });

  it('переключает статус Мастер-календаря', () => {
    const emit = vi.fn() as unknown as Tab2ErasSyncEmits;
    const { toggleMasterStatus } = useTab2ErasSync({ calendarData: mockCalendar }, emit);

    toggleMasterStatus(true);
    expect(emit).toHaveBeenCalledWith('update', { is_master: true });
  });
});
