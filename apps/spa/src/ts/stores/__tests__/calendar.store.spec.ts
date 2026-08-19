import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCalendarStore } from '../calendar.store';
import * as api from '../../services/api.client';
import { clearCache } from '../../utils/requestCache';

vi.mock('../../services/api.client', () => ({
  getCalendars: vi.fn(),
  saveCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
}));

describe('calendar.store', () => {
  let store: ReturnType<typeof useCalendarStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    clearCache();
    vi.clearAllMocks();
    store = useCalendarStore();
  });

  describe('getCalendars', () => {
    it('returns existing calendars if master is already present', async () => {
      const mockList = [
        { id: 'cal_1', name: 'Master Cal', is_master: true, is_default: true },
      ];
      vi.mocked(api.getCalendars).mockResolvedValue(mockList as any);

      const result = await store.getCalendars('project_1');
      expect(api.getCalendars).toHaveBeenCalledWith('project_1');
      expect(result).toEqual(mockList);
    });

    it('promotes default calendar to master if none has is_master', async () => {
      const mockList = [
        { id: 'cal_1', name: 'Standard Cal', is_default: true, data: { name: 'Standard Cal' } },
      ];
      vi.mocked(api.getCalendars).mockResolvedValue(mockList as any);
      vi.mocked(api.saveCalendar).mockResolvedValue({} as any);

      const result = await store.getCalendars('project_1');
      expect(api.saveCalendar).toHaveBeenCalledWith(
        'project_1',
        expect.objectContaining({ is_master: true })
      );
      expect(result[0].is_master).toBe(true);
    });

    it('creates default calendar when no calendars exist in project', async () => {
      vi.mocked(api.getCalendars)
        .mockResolvedValueOnce([]) // First fetch returns empty
        .mockResolvedValueOnce([{ id: 'new_cal', name: 'Календарь Мира', is_master: true }] as any); // After save
      vi.mocked(api.saveCalendar).mockResolvedValue({} as any);

      const result = await store.getCalendars('empty_proj');
      expect(api.saveCalendar).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Календарь Мира');
    });

    it('returns empty array on API error', async () => {
      vi.mocked(api.getCalendars).mockRejectedValue(new Error('Network error'));
      const result = await store.getCalendars('err_proj');
      expect(result).toEqual([]);
    });
  });

  describe('loadCalendar', () => {
    it('loads default calendar data with _id field populated', async () => {
      const mockList = [
        { id: 'cal_1', is_default: true, is_master: true, data: { название: 'Календарь' } },
      ];
      vi.mocked(api.getCalendars).mockResolvedValue(mockList as any);

      const cal = await store.loadCalendar('project_1');
      expect(cal).toBeDefined();
      expect(cal?._id).toBe('cal_1');
      expect((cal as any).название).toBe('Календарь');
    });

    it('returns null if list is empty', async () => {
      vi.mocked(api.getCalendars).mockResolvedValue([]);
      const cal = await store.loadCalendar('project_1');
      expect(cal).toBeNull();
    });
  });

  describe('saveCalendar & deleteCalendar', () => {
    it('formats payload and saves calendar', async () => {
      vi.mocked(api.saveCalendar).mockResolvedValue({} as any);

      const calData: any = {
        _id: 'cal_1',
        название: 'Мой календарь',
        is_default: true,
        is_master: false,
        месяцы: [],
      };

      const success = await store.saveCalendar('project_1', calData);
      expect(success).toBe(true);
      expect(api.saveCalendar).toHaveBeenCalledWith(
        'project_1',
        expect.objectContaining({
          id: 'cal_1',
          name: 'Мой календарь',
          project_id: 'projects:project_1',
        })
      );
    });

    it('deletes calendar and invalidates cache', async () => {
      vi.mocked(api.deleteCalendar).mockResolvedValue(undefined as any);

      const success = await store.deleteCalendar('cal_1');
      expect(success).toBe(true);
      expect(api.deleteCalendar).toHaveBeenCalledWith('cal_1');
    });
  });

  describe('isValidCalendar', () => {
    it('validates calendar months and epochs', () => {
      const valid: any = {
        месяцы: [{ название: 'Январь', дней: 30 }],
        эпохи: [{ название: 'Эра 1' }],
      };
      expect(store.isValidCalendar(valid)).toBe(true);

      const invalid: any = {
        месяцы: [],
        эпохи: [],
      };
      expect(store.isValidCalendar(invalid)).toBe(false);
      expect(store.isValidCalendar(null as any)).toBeFalsy();
    });
  });
});
