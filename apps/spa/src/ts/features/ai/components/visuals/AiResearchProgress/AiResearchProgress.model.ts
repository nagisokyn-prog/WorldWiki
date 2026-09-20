export type ResearchStage = 'planning' | 'searching' | 'reading' | 'synthesizing' | 'completed' | 'idle';

export interface AiResearchProgressProps {
  stage?: ResearchStage;
  query?: string;
  hitsCount?: number;
  pagesCount?: number;
  evidenceCount?: number;
}
