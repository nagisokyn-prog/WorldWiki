import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';
import { performanceManager } from '../../../ts/services/performance.service.js';

export function useSettingsPerformance(
  getSettings: () => AppSettings,
  save: () => Promise<void>
) {
  const { t } = useI18n();
  const showAdvanced = ref(false);

  const statusColorClass = computed(() => {
    const status = performanceManager.status.value;
    if (status === 'Good') return 'text-success';
    if (status === 'Limited') return 'text-warning';
    if (status === 'Poor') return 'text-error';
    return 'text-success';
  });

  const recommendedProfile = computed<'Eco' | 'Balanced' | 'Quality' | 'Max'>(() => {
    const status = performanceManager.status.value;
    if (status === 'Poor') return 'Eco';
    if (status === 'Limited') return 'Balanced';
    return 'Quality';
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
    performanceManager,
    showAdvanced,
    statusColorClass,
    recommendedProfile,
    setProfile
  };
}
