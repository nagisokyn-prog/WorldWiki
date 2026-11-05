import { describe, it, expect, vi } from 'vitest';
import { useTab5ReformsDst } from './useTab5ReformsDst';
import {
  calculateDualDating,
  calculateNewStyleFirstDay,
  calculateVisualTape,
  formatSliderTime,
} from './tab5ReformsDst.utils';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('Tab 5: Reforms, Succession & DST', () => {
  const mockCalendar = {
    название: 'Reforms Calendar',
    месяцы: [
      { название: 'Январь', дней: 31 },
      { название: 'Февраль', дней: 28 },
      { название: 'Март', дней: 31 },
      { название: 'Октябрь', дней: 31 },
    ],
    названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  } as unknown as CalendarData;

  describe('Pure Utils (tab5ReformsDst.utils)', () => {
    it('calculates first day of new style for Gregorian 1582', () => {
      const firstNew = calculateNewStyleFirstDay({
        oldDay: 4,
        oldMonth: 10,
        oldYear: 1582,
        droppedDays: 10,
      });
      expect(firstNew).toBe('15 Октября 1582');
    });

    it('generates visual tape for all 3 modes', () => {
      const tapeGap = calculateVisualTape('gap', { oldDay: 4, oldMonth: 10, oldYear: 1582, droppedDays: 10 }, { transitionalYear: -46, addedDays: 90 }, { resetDay: 22, resetMonth: 9, resetYearOld: 1792, resetToYear: 1 }, '15 Октября 1582');
      expect(tapeGap.middle).toContain('10 дней стёрто');

      const tapeTrans = calculateVisualTape('transitional', { oldDay: 4, oldMonth: 10, oldYear: 1582, droppedDays: 10 }, { transitionalYear: -46, addedDays: 90 }, { resetDay: 22, resetMonth: 9, resetYearOld: 1792, resetToYear: 1 }, '15 Октября 1582');
      expect(tapeTrans.middle).toContain('Переходный год -46');

      const tapeReset = calculateVisualTape('reset', { oldDay: 4, oldMonth: 10, oldYear: 1582, droppedDays: 10 }, { transitionalYear: -46, addedDays: 90 }, { resetDay: 22, resetMonth: 9, resetYearOld: 1792, resetToYear: 1 }, '15 Октября 1582');
      expect(tapeReset.end).toContain('Год 1 Новой Эры');
    });

    it('calculates dual dating correctly', () => {
      const res = calculateDualDating({ day: 12, month: 3, year: 1600 });
      expect(res.osDateStr).toBe('12 Марта 1600 г.');
      expect(res.nsDateStr).toBe('22 Марта 1600 г. (+10 дн)');
      expect(res.quoteStr).toBe('«12 (22) Марта 1600 года»');
      expect(res.mabsMinutes).toBeGreaterThan(0);
    });

    it('formats slider time to HH:MM', () => {
      expect(formatSliderTime(150)).toBe('02:30');
      expect(formatSliderTime(60)).toBe('01:00');
      expect(formatSliderTime(185)).toBe('03:05');
    });
  });

  describe('Composable (useTab5ReformsDst)', () => {
    it('applies Gregorian reform preset', () => {
      const emit = vi.fn();
      const composable = useTab5ReformsDst({ calendarData: mockCalendar }, emit);

      composable.selectReformPreset('gregorian_1582');
      expect(composable.mode.value).toBe('gap');
      expect(composable.gapParams.value.droppedDays).toBe(10);
      expect(composable.modeBadgeText.value).toContain('DiscontinuousGap');
    });

    it('applies Caesar reform preset', () => {
      const emit = vi.fn();
      const composable = useTab5ReformsDst({ calendarData: mockCalendar }, emit);

      composable.selectReformPreset('caesar_46bc');
      expect(composable.mode.value).toBe('transitional');
      expect(composable.transParams.value.transitionalYear).toBe(-46);
      expect(composable.modeBadgeText.value).toContain('TransitionalYear');
    });

    it('applies French Republic epoch reset preset', () => {
      const emit = vi.fn();
      const composable = useTab5ReformsDst({ calendarData: mockCalendar }, emit);

      composable.selectReformPreset('french_1792');
      expect(composable.mode.value).toBe('reset');
      expect(composable.resetParams.value.resetToYear).toBe(1);
      expect(composable.modeBadgeText.value).toContain('EpochReset');
    });

    it('manages DST presets and syncs to calendar data', () => {
      const emit = vi.fn();
      const composable = useTab5ReformsDst({ calendarData: mockCalendar }, emit);

      composable.selectDstPreset('eu_standard');
      expect(composable.policyConfig.value.policy).toBe('relative');
      expect(composable.policyConfig.value.shiftMinutes).toBe(60);
      expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
        dst_policy: expect.objectContaining({ is_enabled: true, spring_shift_minutes: 60 }),
      }));

      composable.selectDstPreset('none');
      expect(composable.policyConfig.value.policy).toBe('none');
      expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
        dst_policy: expect.objectContaining({ is_enabled: false }),
      }));
    });

    it('simulates Spring Gap and Autumn Fold transition hours', () => {
      const emit = vi.fn();
      const composable = useTab5ReformsDst({ calendarData: mockCalendar }, emit);

      // Spring jump at 02:30 (minute 150) -> non-existent gap hour
      composable.simTab.value = 'spring';
      composable.springSliderVal.value = 150;
      expect(composable.springAlertTitle.value).toContain('GAP');
      expect(composable.springAlertDesc.value).toContain('физически не существовало');

      // Autumn fold at 02:30 (minute 150) -> fold 0 vs fold 1
      composable.simTab.value = 'autumn';
      composable.autumnSliderVal.value = 150;
      composable.autumnFold.value = 0;
      expect(composable.autumnAlertDesc.value).toContain('fold: 0');

      composable.autumnFold.value = 1;
      expect(composable.autumnAlertDesc.value).toContain('fold: 1');
    });
  });
});
