import type { ArcType } from '../../StoryArcs.model'

export interface ArcCreateModalProps {
  title: string;
    arcType: ArcType;
}

export type ArcCreateModalEmits = {
  (e: 'update:title', val: string): void;
    (e: 'update:arcType', val: ArcType): void;
    (e: 'close'): void;
    (e: 'create'): void;
};
