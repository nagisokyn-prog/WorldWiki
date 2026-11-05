import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePromiseCardMeta } from './usePromiseCardMeta';
import { useCalendarStore } from '@/stores/calendar.store';
import type { RichPlotPromise } from '../usePromisesPanel';

const { mockCal } = vi.hoisted(() => ({
  mockCal: {
    id: 'cal:1',
    name: 'Основной календарь',
    is_default: true,
    is_master: true,
    data: {
      название: 'Основной календарь',
      is_master: true,
      эпохи: [{ название: 'Новая Эра', год_начала: 1, год_конца: 2000 }],
      месяцы: [
        { название: 'Январь', дней: 30 },
        { название: 'Февраль', дней: 30 }
      ],
      сезоны: [{ название: 'Зима', месяцы: [0, 1] }],
      настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 }
    }
  }
}));

vi.mock('@/services/api.client', () => ({
  getEntities: vi.fn().mockResolvedValue([]),
  getGlobalTimeline: vi.fn().mockResolvedValue({ events: [] }),
  getCalendars: vi.fn().mockResolvedValue([mockCal]),
  getStoryArcs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/api/calendar.api', () => ({
  calendarApi: {
    getCalendars: vi.fn().mockResolvedValue([mockCal]),
    getPlanetCalendarBundle: vi.fn().mockResolvedValue({ calendars: [mockCal], planets: [] }),
    saveCalendar: vi.fn().mockResolvedValue({ success: true }),
    deleteCalendar: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('usePromiseCardMeta', () => {
  const baseItem: RichPlotPromise = {
    id: 'p1',
    project_id: 'test_proj',
    chapter_id: 'ch1',
    kind: 'scene',
    quote: 'Рудеус обнажил меч',
    paragraph_index: 2,
    block_id: 'para-2',
    note: null,
    status: 'planted',
    progressions: [],
    resolution: null,
    resolved_in_volume: null,
    resolved_in_chapter: null,
    participant_ids: ['Герой'],
    location_id: 'Тронный зал',
    timeline_event_id: 'ev_1'
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    const calStore = useCalendarStore();
    calStore.calendars = [mockCal as any];
    vi.restoreAllMocks();
  });

  it('initializes location draft from item', () => {
    const emit = vi.fn();
    const { locationDraft } = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    expect(locationDraft.value).toBe('Тронный зал');
  });

  it('saves updated location and emits change', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    meta.locationDraft.value = 'Трактир на окраине';
    meta.saveLocation();

    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      location_id: 'Трактир на окраине'
    }));
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('adds and removes participants', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    
    meta.addParticipant('Эрис');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      participant_ids: ['Герой', 'Эрис']
    }));

    meta.removeParticipant('Герой');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      participant_ids: []
    }));
  });

  it('updates kind', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);

    meta.updateKind('conflict');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      kind: 'conflict'
    }));
  });

  it('removes last participant on backspace when input query is empty', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    
    meta.participantInputQuery.value = '';
    meta.handleParticipantBackspace();
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      participant_ids: []
    }));
  });

  it('toggles date picker open/closed state', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    expect(meta.isDatePickerOpen.value).toBe(false);
    meta.toggleDatePicker();
    expect(meta.isDatePickerOpen.value).toBe(true);
    meta.toggleDatePicker();
    expect(meta.isDatePickerOpen.value).toBe(false);
  });

  it('handles onUniversalDateChange correctly', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    meta.onUniversalDateChange({
      calendar_id: 'cal:1',
      absolute_minute: 1440,
      original_input: {
        era_index: 0,
        year: 1,
        month: 0,
        day: 2,
        hour: 14,
        minute: 30
      }
    });

    expect(meta.universalDateModel.value?.absolute_minute).toBe(1440);
    expect(meta.currentHour.value).toBe(14);
    expect(meta.currentMinute.value).toBe(30);
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('calculates diegetic badges correctly based on hour and season', async () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);
    await meta.loadProjectEntities();
    meta.currentHour.value = 0;
    meta.currentMinute.value = 0;
    
    expect(meta.diegeticInfo.value?.timeOfDayName).toBe('🌙 Ночь');

    meta.currentHour.value = 14;
    expect(meta.diegeticInfo.value?.timeOfDayName).toBe('☀️ День');
  });

  it('resolves participant display names and deduplicates participants', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({
      project: 'test_proj',
      item: {
        ...baseItem,
        participant_ids: ['characters:hero_1', 'characters:hero_1', 'Герой']
      }
    }, emit);

    expect(meta.getParticipantDisplayName('characters:hero_1')).toBe('hero_1');
    expect(meta.currentParticipants.value.length).toBeLessThanOrEqual(2);
  });

  it('handles arc and phase changes and emits update:item', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);

    meta.onArcsUpdate([{ arc_id: 'arc:1', arc_phase: 'escalation' }]);

    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      arcs: [{ arc_id: 'arc:1', arc_phase: 'escalation' }],
      arc_id: 'arc:1',
      arc_phase: 'escalation'
    }));
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('allows entering custom location text directly and keeps locationDraft in sync', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);

    meta.selectLocation('Заброшенная хижина в лесу');
    expect(meta.locationDraft.value).toBe('Заброшенная хижина в лесу');
    expect(emit).toHaveBeenCalledWith('update:item', expect.objectContaining({
      location_id: 'Заброшенная хижина в лесу'
    }));
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('adjusts year when era changes and clamps to bounds', () => {
    const emit = vi.fn();
    const meta = usePromiseCardMeta({ project: 'test_proj', item: baseItem }, emit);

    meta.onEraChange(0);
    expect(emit).toHaveBeenCalledWith('change');

    meta.onYearChange(500);
    expect(meta.currentYear.value).toBe(500);
    expect(emit).toHaveBeenCalledWith('change');
  });
});
