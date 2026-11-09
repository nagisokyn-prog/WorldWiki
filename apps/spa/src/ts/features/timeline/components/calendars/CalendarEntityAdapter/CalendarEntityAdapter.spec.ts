import { describe, it, expect, vi } from 'vitest';
import { useCalendarEntityAdapter } from './useCalendarEntityAdapter';

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      { id: 'cal_123', name: 'Григорианский', is_master: true, is_default: true, data: { название: 'Григорианский' } },
    ]),
    getPlanets: vi.fn().mockReturnValue([
      { id: 'earth', project_id: 'test_project', name: 'Земля', orbit_days: 365.25, ticks_per_day: 86400 },
    ]),
    savePlanet: vi.fn(),
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
    adapter.onSelectPlanet({
      id: 'mars_1',
      project_id: 'test_project',
      name: 'Марс',
      orbit_days: 687.0,
      ticks_per_day: 88775,
    });

    expect(adapter.activeMode.value).toBe('planet');
    expect(adapter.selectedPlanetId.value).toBe('mars_1');
    expect(adapter.selectedNodeId.value).toBe('planet:mars_1');
  });

  it('переключает режим обратно на календарь при выборе календаря', async () => {
    const emit = vi.fn();
    const adapter = useCalendarEntityAdapter(dummyProps, emit);
    adapter.onSelectPlanet({
      id: 'mars_1',
      project_id: 'test_project',
      name: 'Марс',
      orbit_days: 687.0,
      ticks_per_day: 88775,
    });
    // Ждем первоначальной загрузки списка календарей
    await Promise.resolve();
    adapter.onSelectCalendar(0);

    expect(adapter.activeMode.value).toBe('calendar');
    expect(adapter.selectedCalendarId.value).toBe('cal_123');
  });

  it('добавляет новую планету', async () => {
    const emit = vi.fn();
    const adapter = useCalendarEntityAdapter(dummyProps, emit);
    const initialPlanets = adapter.planetsList.value.length;
    await adapter.onAddPlanet();

    expect(adapter.planetsList.value.length).toBe(initialPlanets + 1);
    expect(adapter.activeMode.value).toBe('planet');
  });
});
