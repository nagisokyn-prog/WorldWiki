import type { Volume } from '../../types/generated/Volume';
import type { Chapter } from '../../types/generated/Chapter';

export interface SearchResult<T> {
  entity: T;
  score: number;
  kind: string;
}

export interface AutoExtendResult {
  chapter_id?: string | null;
  volume_id?: string | null;
  updated_count?: number;
}

export interface ChapterHierarchy {
  volumes: (Volume & { sort_order?: number; [key: string]: unknown })[];
  chapters: (Chapter & { volume_id?: string | null; sort_order?: number; [key: string]: unknown })[];
}

export interface ProjectSummary {
  id?: string;
  name: string;
  created_at?: string;
  genres?: string[];
  perfLevel?: string;
  data?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  icon?: string;
  [key: string]: unknown;
}

export type { Volume } from '../../types/generated/Volume';
export type { Chapter } from '../../types/generated/Chapter';
export type { Entity } from '../../types/generated/Entity';
export type { EntitySchema } from '../../types/generated/EntitySchema';
export type { EntityRel } from '../../types/generated/EntityRel';
export type { RelationSchema } from '../../types/generated/RelationSchema';
export type { Chat } from '../../types/generated/Chat';
export type { ChatMessage } from '../../types/generated/ChatMessage';
export type { AiProfile } from '../../types/generated/AiProfile';
export type { PlotPromise } from '../../types/generated/PlotPromise';
export type { Plan } from '../../types/generated/Plan';
export type { Tag } from '../../types/generated/Tag';
export type { Calendar } from '../../types/generated/Calendar';
export type { AutoApprovalSetting } from '../../types/generated/AutoApprovalSetting';
export type { AiMode } from '../../types/generated/AiMode';
export type { Artifact } from '../../types/generated/Artifact';
export type { AiSkill } from '../../types/generated/AiSkill';
export type { TextBlock } from '../../types/generated/TextBlock';
export type { AgentMemory } from '../../types/generated/AgentMemory';
export type { WebCache } from '../../types/generated/WebCache';
export type { DictionaryWord } from '../../types/generated/DictionaryWord';
export type { Cites } from '../../types/generated/Cites';
