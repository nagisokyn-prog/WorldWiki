import { ref, computed, watch, onMounted } from 'vue';
import { useCalendarStore } from '../../../stores/calendar.store';
import { CalendarMath } from '../../../services/Calendars/calendar.math';
import { settingsService } from '@worldwiki/components';
import type { AppSettings } from '@worldwiki/components';
import type { CalendarData, CalendarEra, CalendarMonth } from '../../../services/Calendars/calendar.types';

export interface DateWheelsModelValue {
  эпоха_ключ?: number;
  год?: number;
  месяц?: number;
  день?: number;
  [key: string]: unknown;
}

export interface DateWheelsProps {
  project: string;
  modelValue?: DateWheelsModelValue | null;
}

export function useDateWheels(props: DateWheelsProps, emit: (event: 'update:modelValue', val: unknown) => void) {
    const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');
    const calendar = ref<CalendarData | null>(null);

    const currentEraIdx = ref(0);
    const currentYear = ref(1);
    const currentMonthIdx = ref(0);
    const currentDay = ref(1);

    const eras = computed<CalendarEra[]>(() => calendar.value?.эпохи || []);
    const months = computed<CalendarMonth[]>(() => calendar.value?.месяцы || []);

    const currentEra = computed(() => eras.value[currentEraIdx.value] || eras.value[0] || {
        год_начала: 1, год_конца: 9999, название: ''
    });

    const yearRange = computed(() => currentEra.value.год_конца - currentEra.value.год_начала);
    const yearInputMode = computed(() => yearRange.value > 500);

    const eraOptions = computed(() => {
        return eras.value.map((e: CalendarEra, i: number) => ({
            value: i, label: e.название || `Эпоха ${i + 1}`
        }));
    });

    const yearOptions = computed(() => {
        if (yearInputMode.value) return [];
        const opts = [];
        for (let i = currentEra.value.год_начала; i <= currentEra.value.год_конца; i++) {
            opts.push({ value: i, label: String(i) });
        }
        return opts;
    });

    const monthOptions = computed(() => {
        return months.value.map((m: CalendarMonth, i: number) => ({
            value: i, label: m.название || `Месяц ${i + 1}`
        }));
    });

    const maxDaysInMonth = computed(() => {
        if (!calendar.value) return 30;
        return CalendarMath.getDaysInMonth(calendar.value, currentYear.value, currentMonthIdx.value);
    });

    const dayOptions = computed(() => {
        const opts = [];
        const max = maxDaysInMonth.value;
        for (let i = 1; i <= max; i++) {
            opts.push({ value: i, label: String(i) });
        }
        return opts;
    });

    const syncFromProps = (emitIfChanged = false) => {
        const val = props.modelValue;
        if (val && typeof val === 'object') {
            currentEraIdx.value = val.эпоха_ключ !== undefined ? val.эпоха_ключ : 0;
            currentYear.value = val.год !== undefined ? val.год : currentEra.value.год_начала;
            currentMonthIdx.value = val.месяц !== undefined ? val.месяц : 0;
            currentDay.value = val.день !== undefined ? val.день : 1;
        } else {
            currentEraIdx.value = 0;
            currentYear.value = currentEra.value.год_начала;
            currentMonthIdx.value = 0;
            currentDay.value = 1;
        }
        validateValues(emitIfChanged);
    };

    const validateValues = (emitIfChanged = false) => {
        let changed = false;
        if (currentYear.value < currentEra.value.год_начала) {
            currentYear.value = currentEra.value.год_начала;
            changed = true;
        }
        if (currentYear.value > currentEra.value.год_конца) {
            currentYear.value = currentEra.value.год_конца;
            changed = true;
        }
        if (currentMonthIdx.value < 0 || currentMonthIdx.value >= months.value.length) {
            currentMonthIdx.value = 0;
            changed = true;
        }
        const max = maxDaysInMonth.value;
        if (currentDay.value < 1) {
            currentDay.value = 1;
            changed = true;
        }
        if (currentDay.value > max) {
            currentDay.value = max;
            changed = true;
        }
        if (changed && emitIfChanged) emitUpdate();
    };

    const emitUpdate = () => {
        emit('update:modelValue', {
            эпоха_ключ: currentEraIdx.value,
            год: currentYear.value,
            месяц: currentMonthIdx.value,
            день: currentDay.value
        });
    };

    const onEraChange = () => {
        if (currentYear.value < currentEra.value.год_начала || currentYear.value > currentEra.value.год_конца) {
            currentYear.value = currentEra.value.год_начала;
        }
        validateValues();
        emitUpdate();
    };

    const onYearChange = () => {
        validateValues();
        emitUpdate();
    };

    const onMonthChange = () => {
        validateValues();
        emitUpdate();
    };

    const onDayChange = () => {
        validateValues();
        emitUpdate();
    };

    onMounted(async () => {
        let cal = await useCalendarStore().loadCalendar(props.project);
        if (!cal) cal = CalendarMath.getDefaultCalendar();
        calendar.value = cal;

        syncFromProps();

        settingsService.onChange((s: AppSettings) => wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal');
    });

    watch(() => props.modelValue, (newVal) => {
        if (!newVal) return;
        if (newVal.эпоха_ключ !== currentEraIdx.value || newVal.год !== currentYear.value || newVal.месяц !== currentMonthIdx.value || newVal.день !== currentDay.value) {
            syncFromProps();
        }
    }, { deep: true });

    return {
        wheelHorizontal,
        calendar,
        currentEraIdx,
        currentYear,
        currentMonthIdx,
        currentDay,
        eras,
        months,
        yearInputMode,
        eraOptions,
        yearOptions,
        monthOptions,
        dayOptions,
        onEraChange,
        onYearChange,
        onMonthChange,
        onDayChange,
        currentEra
    };
}
