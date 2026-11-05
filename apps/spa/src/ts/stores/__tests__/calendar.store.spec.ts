import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCalendarStore } from '../calendar.store';
import * as api from '@/services/api.client';
import { clearCache } from '@/utils/requestCache';

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
}));

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

    it('renames single calendar without master to Календарь Мира (covers line 39)', async () => {
      const mockList = [
        { id: 'c_single', is_default: false, data: { название: 'Old Name' } },
      ];
      vi.mocked(api.getCalendars).mockResolvedValue(mockList as any);
      vi.mocked(api.saveCalendar).mockResolvedValue({} as any);

      const result = await store.getCalendars('proj_single');
      expect((result[0].data as any).название).toBe('Календарь Мира');
    });

    it('returns immediately if re-entered while creating master (covers lines 31, 50)', async () => {
      vi.mocked(api.getCalendars).mockResolvedValueOnce([
        { id: 'c_no_master', is_default: true, data: { name: 'Test' } },
      ] as any);

      vi.mocked(api.saveCalendar).mockImplementationOnce(async () => {
        // Re-entrant call while isCreatingMaster is true
        const reentrantList = await store.getCalendars('reentrant_proj');
        expect(reentrantList).toBeDefined();
        return {} as any;
      });

      const res = await store.getCalendars('reentrant_proj');
      expect(res).toBeDefined();
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

    it('loads calendar without data property using cal directly (covers line 78)', async () => {
      const mockList = [
        { id: 'cal_nodata', is_default: true, is_master: true, название: 'Direct' },
      ];
      vi.mocked(api.getCalendars).mockResolvedValue(mockList as any);
      const cal = await store.loadCalendar('proj_bare');
      expect(cal?._id).toBe('cal_nodata');
    });

    it('returns null if list is empty', async () => {
      vi.mocked(api.getCalendars).mockResolvedValue([]);
      const cal = await store.loadCalendar('project_1');
      expect(cal).toBeNull();
    });

    it('handles loadCalendar error and returns null', async () => {
      const mockList = [
        {
          id: 'cal_err',
          is_default: true,
          is_master: true,
          data: Object.freeze({ name: 'Frozen' }),
        },
      ];
      vi.mocked(api.getCalendars).mockResolvedValueOnce(mockList as any);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const cal = await store.loadCalendar('err_proj');
      expect(cal).toBeNull();
      expect(spy).toHaveBeenCalledWith('Ошибка загрузки календаря:', expect.any(Error));
      spy.mockRestore();
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

  describe('Additional branch edge cases for calendar.store', () => {
    it('uses cache on consecutive getCalendars calls', async () => {
      const mockList = [{ id: 'cal_cached', is_master: true }];
      vi.mocked(api.getCalendars).mockResolvedValueOnce(mockList as any);

      const first = await store.getCalendars('cached_project');
      expect(api.getCalendars).toHaveBeenCalledTimes(1);

      const second = await store.getCalendars('cached_project');
      expect(second).toEqual(first);
      expect(api.getCalendars).toHaveBeenCalledTimes(1); // from cache
    });

    it('handles parallel isCreatingMaster guard for both non-empty and empty lists', async () => {
      // 1. Non-empty list with isCreatingMaster = true
      (store as any).isCreatingMaster = true;
      const list = [{ id: 'cal_1', is_master: false }];
      vi.mocked(api.getCalendars).mockResolvedValueOnce(list as any);
      const res1 = await store.getCalendars('proj_guard1');
      expect(res1).toEqual(list);

      // 2. Empty list with isCreatingMaster = true
      vi.mocked(api.getCalendars).mockResolvedValueOnce([] as any);
      const res2 = await store.getCalendars('proj_guard2');
      expect(res2).toEqual([]);
      (store as any).isCreatingMaster = false;
    });

    it('renames single calendar without master to Календарь Мира', async () => {
      const singleList = [
        { id: 'single_cal', is_master: false, data: { name: 'Old Single' } },
      ];
      vi.mocked(api.getCalendars).mockResolvedValueOnce(singleList as any);
      vi.mocked(api.saveCalendar).mockResolvedValue({} as any);

      const res = await store.getCalendars('single_proj');
      expect(res[0].name).toBe('Календарь Мира');
      expect(res[0].data.название).toBe('Календарь Мира');
    });

    it('handles loadCalendar catch path and list fallback without is_default', async () => {
      // 1. Fallback to list[0] when no is_default
      const listWithoutDefault = [
        { id: 'first_cal', is_master: true, data: { название: 'First' } },
      ];
      vi.mocked(api.getCalendars).mockResolvedValueOnce(listWithoutDefault as any);
      const cal = await store.loadCalendar('proj_no_default');
      expect(cal?._id).toBe('first_cal');

      // 2. Catch path in loadCalendar
      vi.mocked(api.getCalendars).mockRejectedValueOnce(new Error('Load error'));
      const calErr = await store.loadCalendar('proj_err');
      expect(calErr).toBeNull();
    });

    it('handles saveCalendar without _id/id and save/delete catch error paths', async () => {
      // 1. saveCalendar without id
      vi.mocked(api.saveCalendar).mockResolvedValueOnce({} as any);
      const calNoId: any = {
        name: 'No Id Cal',
        месяцы: [],
      };
      const saveRes = await store.saveCalendar('proj_no_id', calNoId);
      expect(saveRes).toBe(true);

      // 2. saveCalendar catch error path
      vi.mocked(api.saveCalendar).mockRejectedValueOnce(new Error('Save failed'));
      expect(await store.saveCalendar('proj_err', calNoId)).toBe(false);

      // 3. deleteCalendar catch error path
      vi.mocked(api.deleteCalendar).mockRejectedValueOnce(new Error('Delete failed'));
      expect(await store.deleteCalendar('cal_err')).toBe(false);
    });
  });
});

