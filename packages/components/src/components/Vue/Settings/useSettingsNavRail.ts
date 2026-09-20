import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SettingsNavRailProps, SettingsNavRailEmits, SettingsNavItem } from './SettingsNavRail.model';

export function useSettingsNavRail(
  _props: SettingsNavRailProps,
  emit: SettingsNavRailEmits
) {
  const { t } = useI18n();

  const items = computed<SettingsNavItem[]>(() => [
    { id: 'appearance', icon: '✦', label: t('settings.scenes.appearance.title') },
    { id: 'interface', icon: '◇', label: t('settings.scenes.interface.title') },
    { id: 'motion', icon: '◌', label: t('settings.scenes.motion.title') },
    { id: 'typography', icon: 'Aa', label: t('settings.scenes.typography.title') },
    { id: 'editor', icon: '◫', label: t('settings.scenes.editor.title') },
    { id: 'performance', icon: '⚡', label: t('settings.scenes.performance.title') }
  ]);

  const handleSelectTab = (tabId: string) => {
    emit('update:activeTab', tabId);
    emit('update:active-tab', tabId);
  };

  return {
    t,
    items,
    handleSelectTab
  };
}
