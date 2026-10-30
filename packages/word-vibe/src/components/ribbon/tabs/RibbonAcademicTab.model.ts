import type { RibbonCommands } from '../../../ribbon/commands';

export interface RibbonAcademicTabProps {
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  commands: Partial<RibbonCommands>;
}

export type RibbonAcademicTabEmits = {
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'applyGostPreset', preset: string): void;
  (e: 'applyCiteStyle', style: string): void;
};

