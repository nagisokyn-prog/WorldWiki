export interface RibbonGostPresetsGroupProps {
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
}

export type RibbonGostPresetsGroupEmits = {
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'applyGostPreset', preset: string): void;
  (e: 'applyCiteStyle', style: string): void;
};

