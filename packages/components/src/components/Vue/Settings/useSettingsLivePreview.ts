import { computed, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';

export function useSettingsLivePreview(getSettings: () => AppSettings) {
  const { t } = useI18n();

  const previewStyles = computed<CSSProperties>(() => {
    const s = getSettings();
    const c = s.colors;
    return {
      '--bg-base': c.bgBase,
      '--bg-secondary': c.bgSecondary,
      '--bg-panel': c.bgPanel,
      '--text-main': c.textMain,
      '--text-muted': c.textMuted,
      '--border-color': c.borderColor,
      '--shadow-color': c.shadowColor,
      '--accent-color': c.accent,
      '--accent-text': c.accentText,
      '--preview-font': s.fonts?.family || 'inherit',
      '--preview-padding': ((s.spacing?.density || 1) * 16) + 'px',
      '--preview-card-radius': (s.radii?.card || 8) + 'px',
      '--preview-glass-blur': (s.glass?.blur || 0) + 'px',
      '--preview-card-shadow': `0 ${s.shadows?.islandY || 4}px ${s.shadows?.islandBlur || 12}px var(--shadow-color)`,
      '--preview-btn-radius': (s.radii?.btn || 4) + 'px'
    } as CSSProperties;
  });

  return {
    t,
    previewStyles
  };
}
