import { describe, it, expect, vi } from 'vitest';
import { useCalendarEntityAdapter } from './useCalendarEntityAdapter';
import type { CalendarRecord } from '@/stores/calendar.store';

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    calendars: [
      { id: 'cal_123', name: 'Григорианский', is_master: true, is_default: true, data: {} },
    ],
    getCalendars: vi.fn().mockResolvedValue([]),
    saveCalendar: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('useCalendarEntityAdapter', () => {
  const dummyProps = {
    calendarId: 'cal_123',
    projectId: 'test_project',
    isPreview: false,
  };

  it('инициализирует дефолтный режим calendar', () => {
    const emit = vi.fn();
    const adapter = useCalendarEntityAdapter(dummyProps, emit);
    expect(adapter.activeMode.value).toBe('calendar');
    expect(adapter.selectedCalendarId.value).toBe('cal_123');
  });

  it('переключает режим на планету при выборе планеты', () => {
    const emit = vi.fn();
    const adapter = useCalendarEntityAdapter(dummyProps, emit);
    adapter.onSelectPlanet({ id: 'mars_1', name: 'Марс', orbit_days: 687.0 });

    expect(adapter.activeMode.value).toBe('planet');
    expect(adapter.selectedPlanetId.value).toBe('mars_1');
    expect(adapter.selectedNodeId.value).toBe('planet:mars_1');
  });

  it('переключает режим обратно на календарь при выборе календаря', () => {
    const emit = vi.fn();
    const adapter = useCalendarEntityAdapter(dummyProps, emit);
    adapter.onSelectPlanet({ id: 'mars_1', name: 'Марс', orbit_days: 687.0 });
    adapter.onSelectCalendar(0);

    expect(adapter.activeMode.value).toBe('calendar');
    expect(adapter.selectedCalendarId.value).toBe('cal_123');
  });

  it('добавляет новую планету', () => {
    const emit = vi.fn();
    const adapter = useCalendarEntityAdapter(dummyProps, emit);
    const initialPlanets = adapter.planetsList.value.length;
    adapter.onAddPlanet();

    expect(adapter.planetsList.value.length).toBe(initialPlanets + 1);
    expect(adapter.activeMode.value).toBe('planet');
  });
});
