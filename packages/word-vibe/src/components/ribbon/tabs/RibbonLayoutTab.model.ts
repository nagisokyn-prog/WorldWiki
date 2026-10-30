import type { PaperSize, RibbonCommands } from '../../../ribbon/commands';
import type { MarginPreset, PageOrientation } from '../groups/RibbonPageSetupGroup.model';

export interface RibbonLayoutTabProps {
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  currentPageSize?: PaperSize;
  indentLeftCm?: number;
  indentRightCm?: number;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
  commands: Partial<RibbonCommands>;
}

export type RibbonLayoutTabEmits = {
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'closeDropdown'): void;
  (e: 'applyMarginPreset', preset: MarginPreset): void;
  (e: 'applyOrientation', orient: PageOrientation): void;
  (e: 'applyColumns', count: number): void;
  (e: 'update:pageSize', val: PaperSize): void;
  (e: 'update:indentLeft', val: number): void;
  (e: 'update:indentRight', val: number): void;
  (e: 'update:spacingBefore', val: number): void;
  (e: 'update:spacingAfter', val: number): void;
  (e: 'open-paragraph-dialog'): void;
  (e: 'open-page-setup'): void;
};

