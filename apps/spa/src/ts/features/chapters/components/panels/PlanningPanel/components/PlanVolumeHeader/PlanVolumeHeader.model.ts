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
  volumes?: Array<{ id: string; title?: string; [key: string]: unknown }>;
  currentVolumeId?: string | null;
}

export type PlanVolumeHeaderEmits = {
  (e: 'toggle-collapse'): void;
  (e: 'select-volume', volumeId: string): void;
};

