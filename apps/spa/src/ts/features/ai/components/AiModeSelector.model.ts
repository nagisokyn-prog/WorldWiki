export interface PersonaMode {
  slug: string;
  name: string;
  icon: string;
  description: string;
  hotkey?: string;
}

export interface AiModeSelectorProps {
  activeModeSlug?: string;
  modes?: Array<{ slug: string; name: string }>;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
}

export interface AiModeSelectorEmits {
  (e: 'change-mode', mode: string): void;
  (e: 'open-mode-settings'): void;
}
