import type { AppSettings } from '../../../ts/types/settings.js';
import { toHex, applyHexWithCurrentAlpha } from '../../../ts/tokens/theme.tokens.js';

export function useSettingsAppearance(getSettings: () => AppSettings, save?: () => Promise<void> | void) {
  const updateColorAlpha = (colorKey: keyof AppSettings['colors'], hexCode: string) => {
    const settings = getSettings();
    const current = settings.colors[colorKey] || '';
    settings.colors[colorKey] = applyHexWithCurrentAlpha(current, hexCode);
    void save?.();
  };

  /**
   * Конвертирует alpha (0..1, где 1 = сплошной цвет) в Прозрачность в % (0% = непрозрачный, 100% = прозрачный)
   */
  const getTransparencyPercent = (alpha: number | undefined, defaultAlpha = 1): number => {
    const a = alpha !== undefined ? alpha : defaultAlpha;
    return Math.round((1 - Math.max(0, Math.min(1, a))) * 100);
  };

  /**
   * Конвертирует alpha (0..1) в значение прозрачности для слайдера (0..1)
   */
  const getTransparencyValue = (alpha: number | undefined, defaultAlpha = 1): number => {
    const a = alpha !== undefined ? alpha : defaultAlpha;
    return +(1 - Math.max(0, Math.min(1, a))).toFixed(2);
  };

  /**
   * Устанавливает alpha из значения прозрачности слайдера (0..1)
   */
  const setTransparency = (
    setter: (alpha: number) => void,
    transparencyValue: number
  ) => {
    const clamped = Math.max(0, Math.min(1, transparencyValue));
    const alpha = +(1 - clamped).toFixed(2);
    setter(alpha);
    void save?.();
  };

  /**
   * Устанавливает тип фона
   */
  const setBackgroundType = (type: NonNullable<AppSettings['background']>['type']) => {
    const s = getSettings();
    if (!s.background) {
      s.background = { type, opacity: 1, blur: 0, fit: 'cover' };
    } else {
      s.background.type = type;
    }
    void save?.();
  };

  /**
   * Устанавливает прозрачность фона
   */
  const setBackgroundOpacity = (transparencyValue: number) => {
    const s = getSettings();
    if (!s.background) {
      s.background = { type: 'none', opacity: 1, blur: 0, fit: 'cover' };
    }
    setTransparency(a => {
      s.background!.opacity = a;
    }, transparencyValue);
  };

  return {
    toHex,
    updateColorAlpha,
    getTransparencyPercent,
    getTransparencyValue,
    setTransparency,
    setBackgroundType,
    setBackgroundOpacity
  };
}
