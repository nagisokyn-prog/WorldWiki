export interface PromisesPanelProps {}

export type PromisesPanelEmits = {
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
    (e: 'change'): void;
    (e: 'open-journey'): void;
};
