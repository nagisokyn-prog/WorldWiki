import { ref, computed, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';
import { performanceManager } from '../../../ts/services/performance.service.js';
import type { SettingsPerformanceEmits } from './SettingsPerformance.model';

export function useSettingsPerformance(
  settings: Ref<AppSettings>,
  emit: SettingsPerformanceEmits
) {
  const { t } = useI18n();
  const showAdvanced = ref(false);

  const status = computed(() => performanceManager.status.value);
  const lastP95 = computed(() => performanceManager.lastP95.value);
  const batteryStatus = computed(() => performanceManager.batteryStatus.value);
  const activeLevel = computed(() => settings.value.perf?.level ?? 'Balanced');

  const statusColorClass = computed(() => {
    const s = status.value;
    if (s === 'Good') return 'text-success';
    if (s === 'Limited') return 'text-warning';
    if (s === 'Poor') return 'text-error';
    return 'text-success';
  });

  const recommendedProfile = computed<'Eco' | 'Balanced' | 'Quality' | 'Max'>(() => {
    const s = status.value;
    if (s === 'Poor') return 'Eco';
    if (s === 'Limited') return 'Balanced';
    return 'Quality';
  });

  const autoDowngrade = computed({
    get: () => Boolean(settings.value.perf?.autoDowngrade),
    set: (v: boolean) => {
      const s = settings.value;
      if (s.perf) s.perf.autoDowngrade = v;
      emit('save');
    }
  });

  const limitAnimations = computed({
    get: () => Boolean(settings.value.perf?.limitAnimations),
    set: (v: boolean) => {
      const s = settings.value;
      if (s.perf) s.perf.limitAnimations = v;
      emit('save');
    }
  });

  const limitGlass = computed({
    get: () => Boolean(settings.value.perf?.limitGlass),
    set: (v: boolean) => {
      const s = settings.value;
      if (s.perf) s.perf.limitGlass = v;
      emit('save');
    }
  });

  const setProfile = (level: 'Eco' | 'Balanced' | 'Quality' | 'Max') => {
    performanceManager.applyProfile(level);
    const s = settings.value;
    if (s.perf) {
      s.perf.level = level;
    }
    emit('save');
  };

  return {
    t,
    status,
    lastP95,
    batteryStatus,
    activeLevel,
    showAdvanced,
    statusColorClass,
    recommendedProfile,
    autoDowngrade,
    limitAnimations,
    limitGlass,
    setProfile
  };
}
