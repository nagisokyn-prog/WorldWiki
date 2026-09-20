export interface SettingsNavItem {
  id: string;
  icon: string;
  label: string;
}

export interface SettingsNavRailProps {
  activeTab: string;
}

export type SettingsNavRailEmits = {
  (e: 'update:activeTab', tab: string): void;
  (e: 'update:active-tab', tab: string): void;
};
