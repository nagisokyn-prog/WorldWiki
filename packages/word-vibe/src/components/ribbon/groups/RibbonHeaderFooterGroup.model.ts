import type { RibbonCommands } from '../../../ribbon/commands';

export type HeaderPreset = 'empty' | 'chapter-left' | 'chapter-center';
export type FooterPreset = 'empty' | 'page-right' | 'page-center' | 'page-only-right';
export type PageNumberPosition =
  | 'header-left'
  | 'header-center'
  | 'header-right'
  | 'footer-left'
  | 'footer-center'
  | 'footer-right';

export interface RibbonHeaderFooterGroupProps {
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  commands: Partial<RibbonCommands>;
}

export type RibbonHeaderFooterGroupEmits = {
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'closeDropdown'): void;
  (e: 'applyHeaderPreset', preset: HeaderPreset): void;
  (e: 'applyFooterPreset', preset: FooterPreset): void;
  (e: 'applyPageNumberPosition', pos: PageNumberPosition): void;
};

