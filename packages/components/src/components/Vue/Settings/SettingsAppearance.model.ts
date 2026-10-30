export interface SettingsAppearanceProps {
  save: () => Promise<void>;
}

export type SettingsAppearanceEmits = {
  (e: 'pick-background-file'): void;
};

