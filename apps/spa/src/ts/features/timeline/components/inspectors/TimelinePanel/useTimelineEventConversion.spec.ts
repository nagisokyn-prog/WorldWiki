import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useTimelineEventConversion } from './useTimelineEventConversion';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';
import type { CalendarRecord } from '@/stores/calendar.store';
import type { TimelineEvent } from './useTimelinePanel';

describe('useTimelineEventConversion', () => {
  const earthCal = {
    ...CalendarEngine.getDefaultCalendar(),
    название: 'Земной',
    сезоны: [{ название: 'Весна', цвет: '#0f0', месяцы: [0, 1, 2] }]
  };

  const localCal = {
    ...CalendarEngine.getDefaultCalendar(),
    название: 'Местный',
    эпохи: [{ название: 'Эра Света', год_начала: 1, год_конца: 9999 }]
  };

  const availableCalendars = ref<CalendarRecord[]>([
    { id: 'cal:master', is_master: true, data: earthCal },
    { id: 'cal:local', is_master: false, data: localCal }
  ]);

  const selectedCalendarIds = ref<string[]>(['cal:master', 'cal:local']);

  const events = ref<TimelineEvent[]>([
    { date: { era: 0, year: 1, month: 0, day: 1 }, time: { hour: 2, minute: 15 }, description: 'Ночь', calendar_id: 'cal:master' },
    { date: { era: 0, year: 1, month: 0, day: 2 }, time: { hour: 8, minute: 30 }, description: 'Утро', calendar_id: 'cal:master' },
    { date: { era: 0, year: 1, month: 0, day: 3 }, time: { hour: 14, minute: 0 }, description: 'День', calendar_id: 'cal:master' },
    { date: { era: 0, year: 1, month: 0, day: 4 }, time: { hour: 19, minute: 45 }, description: 'Вечер', calendar_id: 'cal:master' }
  ]);

  it('provides era, month, hour, and minute options with fallbacks', () => {
    const conv = useTimelineEventConversion(events, availableCalendars, selectedCalendarIds);

    expect(conv.masterCalendar.value?.название).toBe('Земной');
    expect(conv.getEraOptions('cal:local')[0].label).toBe('Эра Света');
    expect(conv.getMonthOptions('cal:master').length).toBeGreaterThan(0);
    expect(conv.getHourOptions('cal:master')).toHaveLength(24);
    expect(conv.getMinuteOptions('cal:master')).toHaveLength(60);

    expect(conv.getEraOptions('missing')).toEqual([]);
    expect(conv.getMonthOptions('missing')).toEqual([]);
  });

  it('computes convertedDateInfoMap for all times of day and resolves cached/uncached getConvertedDateInfo', () => {
    const conv = useTimelineEventConversion(events, availableCalendars, selectedCalendarIds);

    const map = conv.convertedDateInfoMap.value;
    expect(map.get('0:cal:master')?.timeOfDayType).toBe('night');
    expect(map.get('1:cal:master')?.timeOfDayType).toBe('morning');
    expect(map.get('2:cal:master')?.timeOfDayType).toBe('day');
    expect(map.get('3:cal:master')?.timeOfDayType).toBe('evening');
    expect(map.get('0:cal:master')?.isNative).toBe(true);
    expect(map.get('0:cal:local')?.isNative).toBe(false);

    // Cached lookup via idx
    expect(conv.getConvertedDateInfo(events.value[1], 'cal:master', 1)?.timeOfDayType).toBe('morning');

    // Uncached lookup without idx for all time bands
    expect(conv.getConvertedDateInfo(events.value[0], 'cal:master')?.timeOfDayType).toBe('night');
    expect(conv.getConvertedDateInfo(events.value[1], 'cal:master')?.timeOfDayType).toBe('morning');
    expect(conv.getConvertedDateInfo(events.value[2], 'cal:master')?.timeOfDayType).toBe('day');
    expect(conv.getConvertedDateInfo(events.value[3], 'cal:master')?.timeOfDayType).toBe('evening');

    // Unknown calendar returns null
    expect(conv.getConvertedDateInfo(events.value[0], 'unknown')).toBeNull();
  });
});
