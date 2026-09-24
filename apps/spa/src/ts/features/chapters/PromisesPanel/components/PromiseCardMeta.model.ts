import type { RichPlotPromise } from '../usePromisesPanel';

export interface PromiseCardMetaProps {
  project: string;
  item: RichPlotPromise;
  chapterId?: string | null;
}

export interface PromiseCardMetaEmits {
  (e: 'update:item', item: RichPlotPromise): void;
  (e: 'change'): void;
}

export interface ProjectEntityOption {
  id: string;
  name: string;
  type?: string;
}

export interface TimelineEventOption {
  id: string;
  title: string;
  m_abs?: number;
}
