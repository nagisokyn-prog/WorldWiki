import type { AppSettings } from '../../../ts/types/settings.js';
import { toHex, applyHexWithCurrentAlpha } from '../../../ts/tokens/theme.tokens.js';

export function useSettingsAppearance(getSettings: () => AppSettings, save?: () => Promise<void> | void) {
  const updateColorAlpha = (colorKey: keyof AppSettings['colors'], hexCode: string) => {
    const settings = getSettings();
    const current = settings.colors[colorKey] || '';
    settings.colors[colorKey] = applyHexWithCurrentAlpha(current, hexCode);
    void save?.();
  };

  return {
    toHex,
    updateColorAlpha
  };
}
