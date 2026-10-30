import type { EntitySchema } from '../../../../types/generated/EntitySchema';
import * as api from '../../../../services/api.client';
import { invalidateCache } from '../../../../utils/requestCache';

export interface QuickCreateParams {
  name: string;
  chosenType: string;
  sourceMention: string;
  saveAsTag: boolean;
  project: string;
  loadedSchemas: EntitySchema[];
}

export async function executeQuickCreate(params: QuickCreateParams): Promise<{ id: string; name: string; type: string }> {
  const { name, chosenType, sourceMention, saveAsTag, project, loadedSchemas } = params;
  const schema = loadedSchemas.find(s => s.type_key === chosenType);
  const fullSchema = schema?.full_schema as Record<string, unknown> | undefined;
  const firstSection = (fullSchema?.sections as Array<{ fields?: Array<{ path?: string; id?: string; class?: string }> }>)?.[0];
  const firstField = firstSection?.fields?.[0];
  const firstFieldPath = firstField?.path || firstField?.id || firstField?.class || (fullSchema?.titleField as string) || 'название';

  const initialTags: string[] = [];
  const initialAliases: string[] = [];
  if (saveAsTag && sourceMention && sourceMention.toLowerCase() !== name.toLowerCase()) {
    initialTags.push(sourceMention);
    initialAliases.push(sourceMention);
  }

  const attributes: Record<string, unknown> = {
    name,
    'теги': initialTags,
    tags: initialTags,
    aliases: initialAliases,
    'псевдонимы': initialAliases,
    [firstFieldPath]: name
  };

  const payload: Record<string, unknown> = {
    name,
    entity_type: chosenType,
    attributes,
    tags: initialTags,
    'теги': initialTags
  };

  const created = await api.saveEntity(project, payload as never);
  invalidateCache('entities:');
  invalidateCache('tags:');
  const newId = String(created.id || '');
  document.dispatchEvent(new CustomEvent('ww:entity-saved', { detail: { type: chosenType, id: newId } }));
  if (initialTags.length > 0) {
    document.dispatchEvent(new CustomEvent('ww:tags-updated', { detail: { project, entityId: newId, tags: initialTags } }));
  }

  return { id: newId, name, type: chosenType };
}

export function buildUpdatedEntityTags(
  entity: Record<string, unknown>,
  targetTag: string
): { nextTags: string[]; nextAliases: string[]; nextAttrs: Record<string, unknown> } {
  const existingTags = Array.isArray(entity.cleanTags) && entity.cleanTags.length > 0
    ? (entity.cleanTags as string[])
    : Array.isArray(entity.tags) && (entity.tags as string[]).length > 0
      ? (entity.tags as string[])
      : Array.isArray(entity['теги'])
        ? (entity['теги'] as string[])
        : [];

  const nextTags = Array.from(new Set([...existingTags, targetTag]));
  const currentAttrs = (entity.attributes as Record<string, unknown>) || {};
  const currentAliases = Array.isArray(currentAttrs.aliases)
    ? (currentAttrs.aliases as string[])
    : Array.isArray(currentAttrs['псевдонимы'])
      ? (currentAttrs['псевдонимы'] as string[])
      : [];
  const nextAliases = Array.from(new Set([...currentAliases, targetTag]));
  const nextAttrs = {
    ...currentAttrs,
    'название': currentAttrs['название'] || entity.name,
    tags: nextTags,
    'теги': nextTags,
    aliases: nextAliases,
    'псевдонимы': nextAliases
  };

  return { nextTags, nextAliases, nextAttrs };
}

export function handleEntityTaggingOnSelect(
  entity: Record<string, unknown>,
  targetTag: string,
  project: string
): void {
  if (!targetTag || !project) return;
  const tagLower = targetTag.toLowerCase();
  const existingTags = Array.isArray(entity.cleanTags) && entity.cleanTags.length > 0
    ? (entity.cleanTags as string[])
    : Array.isArray(entity.tags) && (entity.tags as string[]).length > 0
      ? (entity.tags as string[])
      : Array.isArray(entity['теги'])
        ? (entity['теги'] as string[])
        : [];
  const aliases = (entity.aliases || []) as string[];
  const isExactMatch = String(entity.name).toLowerCase() === tagLower ||
    existingTags.some(t => t.toLowerCase() === tagLower) ||
    aliases.some((a: string) => a.toLowerCase() === tagLower);

  if (!isExactMatch) {
    const { nextTags, nextAliases, nextAttrs } = buildUpdatedEntityTags(entity, targetTag);
    void api.saveEntity(project, {
      ...entity,
      tags: nextTags,
      'теги': nextTags,
      attributes: nextAttrs
    } as never).then(() => {
      invalidateCache('entities:');
      invalidateCache('tags:');
      document.dispatchEvent(new CustomEvent('ww:tags-updated', { detail: { project, entityId: String(entity.id), tags: nextTags } }));
    }).catch((e: unknown) => console.warn('[useEntityLinkSelector] Auto-tagging warning:', e));

    entity.cleanTags = nextTags;
    entity.tags = nextTags;
    entity['теги'] = nextTags;
    entity.aliases = nextAliases;
    entity['псевдонимы'] = nextAliases;
  }
}

