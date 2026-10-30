import type { RibbonCommands } from '../../../ribbon/commands';

export interface RibbonReviewTabProps {
  isTrackingChanges: boolean;
  commands: Partial<RibbonCommands>;
}

export type RibbonReviewTabEmits = {};

