import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';
import { performanceManager } from '../../../ts/services/performance.service.js';

export function useSettingsPerformance(
  getSettings: () => AppSettings,
  save: () => Promise<void> | void
) {
  const { t } = useI18n();
  const showAdvanced = ref(false);

  const status = computed(() => performanceManager.status.value);
  const lastP95 = computed(() => performanceManager.lastP95.value);
  const batteryStatus = computed(() => performanceManager.batteryStatus.value);
  const activeLevel = computed(() => getSettings().perf?.level ?? 'Balanced');

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
    get: () => Boolean(getSettings().perf?.autoDowngrade),
    set: (v: boolean) => {
      const s = getSettings();
      if (s.perf) s.perf.autoDowngrade = v;
      void save();
    }
  });

  const limitAnimations = computed({
    get: () => Boolean(getSettings().perf?.limitAnimations),
    set: (v: boolean) => {
      const s = getSettings();
      if (s.perf) s.perf.limitAnimations = v;
      void save();
    }
  });

  const limitGlass = computed({
    get: () => Boolean(getSettings().perf?.limitGlass),
    set: (v: boolean) => {
      const s = getSettings();
      if (s.perf) s.perf.limitGlass = v;
      void save();
    }
  });

  const setProfile = (level: 'Eco' | 'Balanced' | 'Quality' | 'Max') => {
    performanceManager.applyProfile(level);
    const settings = getSettings();
    if (settings.perf) {
      settings.perf.level = level;
    }
    void save();
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
