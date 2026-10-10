import { describe, it, expect, vi } from 'vitest';
import { useSettingsTypography } from '../useSettingsTypography';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => `trans_${key}`,
  }),
}));

describe('useSettingsTypography', () => {
  it('provides translated font options', () => {
    const { fontOptions, t } = useSettingsTypography();

    expect(fontOptions.value).toHaveLength(5);
    expect(fontOptions.value[0].val).toBe('Inter');
    expect(fontOptions.value[0].label).toBe('trans_settings.fonts.interDefault');
    expect(t('any')).toBe('trans_any');
  });
});
