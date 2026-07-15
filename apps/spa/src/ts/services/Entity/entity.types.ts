/**
 * @file entity.types.ts
 * @description Types for Entity Domain
 */

export interface BaseEntity {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  connections: Connection[];
  customFields: Record<string, unknown>;
}

export interface Connection {
  targetId: string;
  type: string;
  description: string;
  strength: number;
}

export interface EntityData {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  [key: string]: unknown;
}

export interface ConnectionData {
  id?: string;
  source?: { entityType: string; entityId: string };
  sourceId?: string;
  sourceType?: string;
  target?: { entityType: string; entityId: string };
  targetId?: string;
  targetType?: string;
  type?: string;
  role?: string;
  description?: string;
  period?: { start_chapter?: string; end_chapter?: string };
  [key: string]: unknown;
}

export interface SchemaInfo {
  name: string;
  icon: string;
  full_schema?: any;
  [key: string]: unknown;
}

export interface EntityType {
  type: string;
  name: string;
  iconEmoji: string;
}
