import type { RibbonCommands } from '../../../ribbon/commands';

export interface RibbonHomeTabProps {
  currentFontFamily: string;
  currentFontSize: string;
  currentLineHeight: string;
  showInvisibles: boolean;
  commands: Partial<RibbonCommands>;
  call: (name: string, fn?: () => void) => void;
}

export type RibbonHomeTabEmits = {
  (e: 'update:fontFamily', val: string): void;
  (e: 'update:fontSize', val: string): void;
  (e: 'update:lineHeight', val: string): void;
  (e: 'stepFontSize', step: number): void;
  (e: 'toggleInvisibles'): void;
  (e: 'open-font-dialog'): void;
  (e: 'open-paragraph-dialog'): void;
};

