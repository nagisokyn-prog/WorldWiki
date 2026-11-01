import { ref, computed } from 'vue';
import type { Tab3AgeTimezoneSectionProps, Tab3AgeTimezoneSectionEmits } from './Tab3AgeTimezoneSection.model';

export const AGE_AT_BIRTH_OPTIONS = [
  { value: '0', label: '0 лет — Европейский стандарт (новорожденному 0 лет)' },
  { value: '1', label: '1 год — Восточноазиатский стандарт (сяй: ребенок рождается в возрасте 1 года)' },
] as const;

export const STEP_ON_NEW_YEAR_OPTIONS = [
  { value: 'birthday', label: '🎂 В личный день рождения (индивидуальная годовщина)' },
  { value: 'new_year', label: '🎍 1-го января Нового Года (коллективно взрослеют в Сольналь)' },
] as const;

export const YEAR_ONLY_OPTIONS = [
  { value: 'exact_date', label: 'По точной дате (Месяц, День)' },
  { value: 'year_only', label: 'Грубо: только по разнице номеров годов' },
] as const;

export const DEFAULT_TIMEZONES = [
  { value: 'UTC+0', label: 'Столичный меридиан (UTC+0, 0ч)' },
  { value: 'UTC+1', label: 'Центральная Европа (UTC+1, +1ч)' },
  { value: 'UTC+2', label: 'Восточноевропейский пояс (UTC+2, +2ч)' },
  { value: 'UTC+3', label: 'Московское время (UTC+3, +3ч)' },
  { value: 'UTC+8', label: 'Восточная Азия / Китай (UTC+8, +8ч)' },
  { value: 'UTC+9', label: 'Япония / Корея (UTC+9, +9ч)' },
  { value: 'UTC-5', label: 'Восточное побережье США (UTC-5, -5ч)' },
];

export function useTab3AgeTimezoneSection(
  props: Tab3AgeTimezoneSectionProps,
  emit: Tab3AgeTimezoneSectionEmits
) {
  const showAddRegion = ref(false);
  const newRegionName = ref('');

  function submitNewRegion() {
    const name = newRegionName.value.trim();
    if (name) {
      emit('add-region', name);
      newRegionName.value = '';
      showAddRegion.value = false;
    }
  }

  const ageAtBirthOptions = AGE_AT_BIRTH_OPTIONS;
  const stepOnNewYearOptions = STEP_ON_NEW_YEAR_OPTIONS;
  const yearOnlyOptions = YEAR_ONLY_OPTIONS;

  const timezonesOptions = computed(() => {
    if (props.timezonesList && props.timezonesList.length > 0) {
      return props.timezonesList;
    }
    return DEFAULT_TIMEZONES;
  });

  return {
    showAddRegion,
    newRegionName,
    submitNewRegion,
    ageAtBirthOptions,
    stepOnNewYearOptions,
    yearOnlyOptions,
    timezonesOptions,
  };
}
