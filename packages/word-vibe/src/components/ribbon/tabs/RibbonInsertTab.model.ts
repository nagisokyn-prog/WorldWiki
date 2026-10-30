import type { RibbonCommands } from '../../../ribbon/commands';
import type { HeaderPreset, FooterPreset, PageNumberPosition } from '../groups/RibbonHeaderFooterGroup.model';

export interface RibbonInsertTabProps {
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  commands: Partial<RibbonCommands>;
}

export type RibbonInsertTabEmits = {
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'closeDropdown'): void;
  (e: 'applyHeaderPreset', preset: HeaderPreset): void;
  (e: 'applyFooterPreset', preset: FooterPreset): void;
  (e: 'applyPageNumberPosition', pos: PageNumberPosition): void;
};

