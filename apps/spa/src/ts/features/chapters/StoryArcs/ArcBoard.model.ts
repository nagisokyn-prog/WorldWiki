export interface ArcBoardProps {
  projectId?: string;
}

export type ArcBoardEmits = {
  (e: 'locate', payload: { chapterId: string; paragraphIndex: number; quote: string; blockId?: string }): void;
};
