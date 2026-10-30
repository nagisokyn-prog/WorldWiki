export interface ConsistencyCheckerProps {
  projectId?: string;
}

export type ConsistencyCheckerEmits = {
  (e: 'jumpToChapter', chapterId: string): void;
    (e: 'openEntity', entityId: string): void;
};
