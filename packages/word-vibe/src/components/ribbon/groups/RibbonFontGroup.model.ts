import type { RibbonCommands } from '../../../ribbon/commands';

export interface RibbonFontGroupProps {
  currentFontFamily: string;
  currentFontSize: string;
  commands: Partial<RibbonCommands>;
  call: (name: string, fn?: () => void) => void;
}

export type RibbonFontGroupEmits = {
  (e: 'update:fontFamily', val: string): void;
  (e: 'update:fontSize', val: string): void;
  (e: 'stepFontSize', step: number): void;
  (e: 'open-font-dialog'): void;
};

