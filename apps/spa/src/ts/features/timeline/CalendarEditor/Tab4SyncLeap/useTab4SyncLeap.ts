import { computed } from 'vue';
import type {
  CalendarData,
  SyncAnchor,
  WorldTimezone,
} from '@/services/Calendars/calendar.types';
import type {
  Tab4SyncLeapProps,
  Tab4SyncLeapEmits,
  CalendarLeapSettings,
} from './Tab4SyncLeap.model';

export function useTab4SyncLeap(
  props: Tab4SyncLeapProps,
  emit: Tab4SyncLeapEmits
) {
  const leapSettings = computed<CalendarLeapSettings>(() => {
    return (
      (props.calendarData?.високос_настройки as CalendarLeapSettings) || {
        тип_правила: 'григорианское',
        интервал: 4,
        дней_добавлять: 1,
      }
    );
  });

  const syncAnchor = computed<SyncAnchor | undefined>(() => {
    return props.calendarData?.sync_anchor;
  });

  const timezones = computed<WorldTimezone[]>(() => {
    return (props.calendarData?.timezones || props.calendarData?.часовые_пояса || []) as WorldTimezone[];
  });

  function updateLeapSettings(patch: Partial<CalendarLeapSettings>) {
    emit('update', {
      високос_настройки: {
        ...leapSettings.value,
        ...patch,
      },
    } as unknown as Partial<CalendarData>);
  }

  function setRuleType(type: 'григорианское' | 'каждый 4 год' | 'пользовательское' | 'отсутствует') {
    updateLeapSettings({ тип_правила: type });
  }

  function updateSyncAnchor(patch: Partial<SyncAnchor>) {
    emit('update', {
      sync_anchor: {
        ...(syncAnchor.value || { linked_to_master: false }),
        ...patch,
      },
    });
  }

  function updateTimezones(newTimezones: WorldTimezone[]) {
    emit('update', { timezones: newTimezones });
  }

  return {
    leapSettings,
    syncAnchor,
    timezones,
    updateLeapSettings,
    setRuleType,
    updateSyncAnchor,
    updateTimezones,
  };
}
