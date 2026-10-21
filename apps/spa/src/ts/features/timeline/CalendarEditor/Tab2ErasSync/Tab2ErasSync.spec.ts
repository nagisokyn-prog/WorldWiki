/**
 * @file Tab2ErasSync.spec.ts
 * @description Unit-тесты для useTab2ErasSync (Синхронизация, эры, вехи)
 */

import { describe, it, expect, vi } from 'vitest';
import { useTab2ErasSync } from './useTab2ErasSync';
import type { Tab2ErasSyncEmits } from './Tab2ErasSync.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab2ErasSync', () => {
  const mockCalendar: CalendarData = {
    название: 'Календарь Империи',
    is_master: false,
    дней_в_неделе: 7,
    названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    первый_месяц_года: 0,
    месяцы: [{ название: 'Январь', дней: 31 }],
    эпохи: [
      { название: 'Эпоха Пепла', год_начала: 1, год_конца: 500 },
      { название: 'Эпоха Возрождения', год_начала: 501, год_конца: 1000 },
    ],
    anchor_events: [
      { id: 'ev_1', name: 'Основание Города', year: 1, month: 0, day: 1 },
    ],
  };

  it('добавляет, перемещает и удаляет эру', () => {
    const emit = vi.fn() as unknown as Tab2ErasSyncEmits;
    const { addEra, reorderEra, removeEra } = useTab2ErasSync({ calendarData: mockCalendar }, emit);

    addEra();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      эпохи: expect.arrayContaining([expect.objectContaining({ название: 'Эпоха 3' })]),
    }));

    reorderEra(0, 1);
    expect(emit).toHaveBeenCalled();

    removeEra(0);
    expect(emit).toHaveBeenCalled();
  });

  it('добавляет и удаляет исторические вехи (Anchor Events)', () => {
    const emit = vi.fn() as unknown as Tab2ErasSyncEmits;
    const { addAnchorEvent, removeAnchorEvent, saveCurrentEvent } = useTab2ErasSync({ calendarData: mockCalendar }, emit);

    addAnchorEvent({ name: 'Коронация', year: 120, month: 2, day: 15 });
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      anchor_events: expect.arrayContaining([expect.objectContaining({ name: 'Коронация' })]),
    }));

    saveCurrentEvent({ id: 'ev_1', name: 'Великое Основание', year: 1 });
    expect(emit).toHaveBeenCalled();

    removeAnchorEvent(0);
    expect(emit).toHaveBeenCalled();
  });

  it('переключает режим синхронизации', () => {
    const emit = vi.fn() as unknown as Tab2ErasSyncEmits;
    const { setSyncType, syncDescription } = useTab2ErasSync({ calendarData: mockCalendar }, emit);

    setSyncType('calendar');
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      sync_anchor: expect.objectContaining({ sync_type: 'calendar' }),
    }));
    expect(syncDescription.value).toBeTruthy();
  });
});
