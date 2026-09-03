import type { AppSettings } from '../../../ts/types/settings.js';

export function useSettingsAppearance(getSettings: () => AppSettings) {
  const toHex = (colorStr: string) => {
    if (!colorStr) return '#000000';
    if (colorStr.startsWith('#')) return colorStr.substring(0, 7);
    if (colorStr.startsWith('rgba')) {
      const parts = colorStr.match(/[\d.]+/g);
      if (parts && parts.length >= 3) {
        const r = parseInt(parts[0]).toString(16).padStart(2, '0');
        const g = parseInt(parts[1]).toString(16).padStart(2, '0');
        const b = parseInt(parts[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return '#000000';
  };

  const updateColorAlpha = (colorKey: keyof AppSettings['colors'], hexCode: string) => {
    const settings = getSettings();
    const current = settings.colors[colorKey];
    let alpha = '1';
    if (current.startsWith('rgba')) {
      const parts = current.match(/[\d.]+/g);
      if (parts && parts.length === 4) {
        alpha = parts[3];
      }
    }
    const r = parseInt(hexCode.slice(1, 3), 16);
    const g = parseInt(hexCode.slice(3, 5), 16);
    const b = parseInt(hexCode.slice(5, 7), 16);
    settings.colors[colorKey] = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return {
    toHex,
    updateColorAlpha
  };
}
