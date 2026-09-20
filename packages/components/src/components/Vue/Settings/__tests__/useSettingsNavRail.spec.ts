import { describe, it, expect, vi } from 'vitest';
import { useSettingsNavRail } from '../useSettingsNavRail';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('useSettingsNavRail', () => {
  it('provides navigation items', () => {
    const emit = vi.fn();
    const { items } = useSettingsNavRail({ activeTab: 'appearance' }, emit as any);

    expect(items.value.length).toBe(6);
    expect(items.value[0].id).toBe('appearance');
  });

  it('emits update tab events symmetrically', () => {
    const emit = vi.fn();
    const { handleSelectTab } = useSettingsNavRail({ activeTab: 'appearance' }, emit as any);

    handleSelectTab('editor');
    expect(emit).toHaveBeenCalledWith('update:activeTab', 'editor');
    expect(emit).toHaveBeenCalledWith('update:active-tab', 'editor');
  });
});
