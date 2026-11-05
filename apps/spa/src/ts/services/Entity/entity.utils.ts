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
  
  // 1. First field from schema or titleField
  const firstField = (schema as { sections?: Array<{ fields?: Array<{ path?: string; id?: string; class?: string }> }> })?.sections?.[0]?.fields?.[0];
  const rawPath = (schema?.titleField as string | undefined) || firstField?.path || firstField?.id || firstField?.class;
  const path = typeof rawPath === 'string' && rawPath.trim().length > 0 ? rawPath.trim() : '';
  if (path) {
    const val = getValueByPath(entity, path) ?? (entity.attributes ? getValueByPath(entity.attributes as Record<string, unknown>, path) : undefined);
    if (val && String(val).trim().length > 0) {
      return String(val).trim();
    }
  }

  // 2. Direct entity name
  const explicitName = entity.name || entity.Name || entity.title || (entity['название'] as string);
  if (explicitName && typeof explicitName === 'string' && explicitName.trim().length > 0) {
    return explicitName.trim();
  }

  // 3. Inside attributes
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  if (attrs && typeof attrs === 'object') {
    const attrName = attrs.name || (attrs['название'] as string) || attrs.title || attrs.label;
    if (attrName && typeof attrName === 'string' && attrName.trim().length > 0) {
      return attrName.trim();
    }
  }

  // 4. Fallback to first non-system property in object
  const IGNORED = new Set(['id', 'project_id', 'schema_id', 'entity_type', 'type_key', 'created_at', 'updated_at', 'attributes', 'embedding', 'tags', 'теги']);
  const keys = Object.keys(entity).filter((k) => !IGNORED.has(k));
  if (keys.length > 0) {
    const firstVal = entity[keys[0]];
    if (typeof firstVal === 'string' && firstVal.trim().length > 0) {
      return firstVal.trim();
    }
  }

  return `[${String(entity.id || 'Unknown').substring(0, 8)}]`;
}
