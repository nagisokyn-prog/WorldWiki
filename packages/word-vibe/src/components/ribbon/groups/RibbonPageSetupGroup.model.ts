import type { RibbonCommands } from '../../../ribbon/commands';

export type MarginPreset = 'gost' | 'narrow' | 'moderate' | 'wide';
export type PageOrientation = 'portrait' | 'landscape';

export interface RibbonPageSetupGroupProps {
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  commands: Partial<RibbonCommands>;
}

export type RibbonPageSetupGroupEmits = {
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'closeDropdown'): void;
  (e: 'applyMarginPreset', preset: MarginPreset): void;
  (e: 'applyOrientation', orient: PageOrientation): void;
  (e: 'applyColumns', count: number): void;
};

