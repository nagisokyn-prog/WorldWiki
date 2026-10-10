import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export interface FontOption {
  val: string;
  label: string;
}

export function useSettingsTypography() {
  const { t } = useI18n();

  const fontOptions = computed<FontOption[]>(() => [
    { val: 'Inter', label: t('settings.fonts.interDefault') },
    { val: 'Roboto', label: t('settings.fonts.roboto') },
    { val: 'SF Pro Display', label: t('settings.fonts.sfPro') },
    { val: 'Segoe UI', label: t('settings.fonts.segoe') },
    { val: 'Fira Code', label: t('settings.fonts.firaCode') }
  ]);

  return {
    t,
    fontOptions,
  };
}
