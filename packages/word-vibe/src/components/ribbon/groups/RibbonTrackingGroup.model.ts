import type { RibbonCommands } from '../../../ribbon/commands';

export interface RibbonTrackingGroupProps {
  isTrackingChanges: boolean;
  commands: Partial<RibbonCommands>;
}

export type RibbonTrackingGroupEmits = {};

