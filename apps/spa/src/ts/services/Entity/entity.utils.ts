/**
 * @file entity.utils.ts
 * @description Utilities for Entity Domain
 */

import { entityApi } from './entity.api';
import type { SchemaInfo } from './entity.types';

const schemaCache: Record<string, SchemaInfo> = {};

export async function loadSchema(project: string, entityType: string): Promise<SchemaInfo | null> {
  if (schemaCache[entityType]) return schemaCache[entityType];
  try {
    const schemas = await entityApi.getSchemas(project);
    if (schemas[entityType]) {
      schemaCache[entityType] = schemas[entityType];
      return schemas[entityType];
    }
  } catch (e) {
    console.error('Failed to load schema', e);
  }
  return null;
}

export function getValueByPath(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((cur: unknown, k: string) => (cur != null && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined), obj as unknown);
}

export function getEntityDisplayName(entity: Record<string, unknown>, schema?: SchemaInfo | null): string {
  if (!entity) return 'Без названия';
  
  // 1. Check titleField from schema
  if (schema && schema.titleField) {
    const val = getValueByPath(entity, schema.titleField as string);
    if (val && String(val).trim().length > 0) {
      return String(val).trim();
    }
  }

  // 2. Fallback to first property in object
  const keys = Object.keys(entity);
  if (keys.length > 0) {
    const firstVal = entity[keys[0]];
    if (typeof firstVal === 'string' && firstVal.trim().length > 0) {
      return firstVal.trim();
    }
  }

  return `[${String(entity.id || 'Unknown').substring(0, 8)}]`;
}
