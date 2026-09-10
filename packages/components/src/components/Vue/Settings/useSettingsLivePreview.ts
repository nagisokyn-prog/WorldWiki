import { computed, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';

export function useSettingsLivePreview(getSettings: () => AppSettings) {
  const { t } = useI18n();

  const previewStyles = computed<CSSProperties>(() => {
    const s = getSettings() || ({} as AppSettings);
    const c = s?.colors || ({} as Record<string, string>);
    return {
      '--bg-base': c?.bgBase || 'var(--color-bg-primary)',
      '--bg-secondary': c?.bgSecondary || 'var(--color-bg-secondary)',
      '--bg-panel': c?.bgPanel || 'var(--color-bg-panel)',
      '--text-main': c?.textMain || 'var(--color-text-primary)',
      '--text-muted': c?.textMuted || 'var(--color-text-muted)',
      '--border-color': c?.borderColor || 'var(--color-border)',
      '--shadow-color': c?.shadowColor || 'rgba(0, 0, 0, 0.3)',
      '--accent-color': c?.accent || 'var(--color-accent)',
      '--accent-text': c?.accentText || 'var(--color-text-primary)',
      '--preview-font': s?.fonts?.family || 'inherit',
      '--preview-padding': (((s?.spacing?.density ?? 1)) * 16) + 'px',
      '--preview-card-radius': ((s?.radii?.card ?? 8)) + 'px',
      '--preview-glass-blur': ((s?.glass?.blur ?? 0)) + 'px',
      '--preview-card-shadow': `0 ${s?.shadows?.islandY ?? 4}px ${s?.shadows?.islandBlur ?? 12}px var(--shadow-color)`,
      '--preview-btn-radius': ((s?.radii?.btn ?? 4)) + 'px'
    } as CSSProperties;
  });

  return {
    t,
    previewStyles
  };
}
