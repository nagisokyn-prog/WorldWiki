import type { RecommendedModelCard } from '@/features/ai/types/ai.types'

export interface LocalAiRecommendedProps {
  recommendedModels: RecommendedModelCard[];
    downloadProgress: Record<string, { percent: number }>;
    isModelInstalled: (filename: string) => boolean;
}

export type LocalAiRecommendedEmits = {
  (e: 'download', repoId: string, filename: string): void;
};
