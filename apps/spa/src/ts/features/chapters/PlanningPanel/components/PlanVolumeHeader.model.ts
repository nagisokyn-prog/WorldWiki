export interface PlanVolumeStats {
  total: number;
  done: number;
  inProgress: number;
  planned: number;
  blocked: number;
}

export interface PlanVolumeHeaderProps {
  title: string;
  stats: PlanVolumeStats;
  isCollapsed?: boolean;
}

export type PlanVolumeHeaderEmits = {
  (e: 'toggle-collapse'): void;
};
