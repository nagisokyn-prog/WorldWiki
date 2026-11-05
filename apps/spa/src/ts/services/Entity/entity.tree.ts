/**
 * @file entity.tree.ts
 * @description Composable for managing entity tree state
 */

import { ref, computed } from 'vue';
import { entityApi } from './entity.api';
import * as api from '../api.client';
import { getCached, setCache } from '@/utils/requestCache';
import { useTreeSelection } from '@worldwiki/components';
import type { SchemaInfo } from './entity.types';

export interface EntityTreeItem {
  id: string;
  _entity: Record<string, unknown>;
  _type: string;
}

export interface EntityTreeSection {
  type: string;
  title: string;
  emoji: string;
}

export interface EntityCtxState {
  x: number;
  y: number;
  entityType: string;
  entity: Record<string, unknown>;
  sect: EntityTreeSection;
}

export function useEntityTree(project: string, emit: (event: string, ...args: unknown[]) => void) {
  const entities = ref<Record<string, Record<string, unknown>[]>>({});
  const entitySections = ref<EntityTreeSection[]>([]);
  const expandedSections = ref<Set<string>>(new Set(['manuscript']));
  const titleFields = ref<Record<string, string>>({});

  const entityKey = (type: string, id: unknown) => `entity:${type}:${String(id)}`;
  const entityCtx = ref<EntityCtxState | null>(null);

  const entityCtxStyle = computed(() => {
    if (!entityCtx.value) return {};
    const x = entityCtx.value.x + 220 > window.innerWidth ? entityCtx.value.x - 220 : entityCtx.value.x;
    const y = entityCtx.value.y + 120 > window.innerHeight ? entityCtx.value.y - 120 : entityCtx.value.y;
    return { top: y + 'px', left: x + 'px' };
  });

  const flatEntityItems = computed<EntityTreeItem[]>(() => {
    const result: EntityTreeItem[] = [];
    console.log('[TREE DEBUG] flatEntityItems recomputing. expandedSections:', [...expandedSections.value], 'sections:', entitySections.value.map(s => s.type));
    for (const sect of entitySections.value) {
      const list = entities.value[sect.type] || [];
      console.log(`[TREE DEBUG]   sect=${sect.type} expanded=${expandedSections.value.has(sect.type)} count=${list.length}`);
      if (!expandedSections.value.has(sect.type)) continue;
      for (const entity of list) {
        result.push({ id: entityKey(sect.type, entity.id), _entity: entity, _type: sect.type });
      }
    }
    console.log('[TREE DEBUG] flatEntityItems result count:', result.length);
    return result;
  });

  const entitySelection = useTreeSelection({
    onDelete: async (keys: string[]) => {
      if (!keys.length) return;
      const { appConfirm } = await import('@worldwiki/components');
      if (!await appConfirm(`Удалить выбранные сущности (${keys.length})?`)) return;

      const itemsToDelete = flatEntityItems.value.filter(i => keys.includes(i.id));
      for (const item of itemsToDelete) {
        emit('delete-entity', item.id, item._type, true);
      }

      for (const item of itemsToDelete) {
        if (entities.value[item._type]) {
          entities.value[item._type] = entities.value[item._type].filter(e => String(e.id) !== String(item._entity.id));
        }
      }
    }
  });

  const entitySelectedInSection = (type: string) => {
    for (const key of entitySelection.selected.value) {
      if (String(key).startsWith(`entity:${type}:`)) return true;
    }
    return false;
  };

  let loadingEntities = false;
  const loadEntities = async () => {
    console.log(`[TREE DEBUG] loadEntities called for project='${project}', loadingEntities=${loadingEntities}`);
    if (loadingEntities) {
      console.warn('[TREE DEBUG] loadEntities SKIPPED — already loading!');
      return;
    }
    loadingEntities = true;
    try {
      console.log('[TREE DEBUG] → calling getSchemas...');
      const schemaCacheKey = `schemas:${project}`;
      let schemas = getCached<Record<string, SchemaInfo>>(schemaCacheKey);
      if (!schemas) {
        schemas = await entityApi.getSchemas(project);
        setCache(schemaCacheKey, schemas);
      }
      console.log('[TREE DEBUG] ← getSchemas returned:', Object.keys(schemas));

      entitySections.value = Object.keys(schemas).map(key => {
        const s = schemas?.[key];
        const iconVal = (s?.icon as string) || '';
        const emojiVal = (s?.iconEmoji as string) || '';
        return {
          type: key,
          title: (s?.name as string) || key,
          emoji: emojiVal || (!iconVal.startsWith('fa') ? iconVal : ''),
          icon: iconVal ? (iconVal.startsWith('fa-') ? `fas ${iconVal}` : iconVal) : ''
        };
      });
      console.log('[TREE DEBUG] entitySections set to:', entitySections.value.map(s => s.type));

      titleFields.value = {};
      for (const [key, schema] of Object.entries(schemas)) {
        if (schema.titleField) {
          titleFields.value[key] = String(schema.titleField);
        }
      }

      const typesToFetch = entitySections.value.map(sect => sect.type);
      console.log(`[TREE DEBUG] → getEntitiesBatch for types:`, typesToFetch);
      
      const batchResult = await api.getEntitiesBatch(project, typesToFetch);
      console.log('[TREE DEBUG] ← getEntitiesBatch returned keys:', Object.keys(batchResult));
      
      const newEntities: Record<string, Record<string, unknown>[]> = batchResult;
      
      console.log('[TREE DEBUG] Setting entities.value, counts:', Object.fromEntries(Object.entries(newEntities).map(([k, a]) => [k, a.length])));
      entities.value = newEntities;
      console.log('[TREE DEBUG] entities.value set done, keys:', Object.keys(entities.value));
    } catch (e) {
      console.error('[TREE DEBUG] ERROR in loadEntities:', e);
    } finally {
      loadingEntities = false;
      console.log('[TREE DEBUG] loadEntities DONE');
    }
  };

  const getValueByPath = (obj: Record<string, unknown> | null | undefined, path: string): unknown => {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((cur: unknown, k: string) => (cur != null && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined), obj as unknown);
  };

  const getEntityName = (entity: Record<string, unknown>, type: string): string => {
    const path = titleFields.value[type];
    if (path) {
      const val = getValueByPath(entity, path);
      if (val) return String(val);
    }
    return (entity.name as string) || 'Без названия';
  };

  const handleEntityClick = (event: MouseEvent, type: string, entity: Record<string, unknown>, _sect: EntityTreeSection) => {
    const key = entityKey(type, entity.id);
    entitySelection.handleClick(event, { id: key }, flatEntityItems.value);
    if (!event.ctrlKey && !event.shiftKey && !event.metaKey) {
      emit('open-entity', { ...entity, entityType: type });
    }
  };

  const openEntityCtx = (e: MouseEvent, type: string, entity: Record<string, unknown>, sect: EntityTreeSection) => {
    const key = entityKey(type, entity.id);
    if (!entitySelection.isSelected(key)) {
      entitySelection.handleClick(new MouseEvent('click'), { id: key }, flatEntityItems.value);
    }
    entityCtx.value = { x: e.clientX, y: e.clientY, entityType: type, entity, sect };
  };

  const toggleSection = (section: string) => {
    console.log(`[TREE DEBUG] toggleSection '${section}', was expanded:`, expandedSections.value.has(section));
    if (expandedSections.value.has(section)) {
      expandedSections.value.delete(section);
      const keys = [...entitySelection.selected.value].filter((k) => String(k).startsWith(`entity:${section}:`));
      if (keys.length > 0) {
        entitySelection.selected.value = new Set([...entitySelection.selected.value].filter((k) => !String(k).startsWith(`entity:${section}:`)));
      }
    } else {
      expandedSections.value.add(section);
    }
    console.log(`[TREE DEBUG] toggleSection '${section}' done, expandedSections:`, [...expandedSections.value]);
  };

  const deleteEntityCtxNode = async () => {
    if (!entityCtx.value) return;
    const { entityType, entity } = entityCtx.value;
    entityCtx.value = null;
    const key = entityKey(entityType, entity.id);

    if (entitySelection.hasSelection.value && entitySelection.isSelected(key) && entitySelection.selectedCount.value > 1) {
      await entitySelection.deleteSelected();
    } else {
      const { appConfirm } = await import('@worldwiki/components');
      if (await appConfirm(`Удалить сущность "${getEntityName(entity, entityType)}"?`)) {
        emit('delete-entity', key, entityType, true);
        if (entities.value[entityType]) {
          entities.value[entityType] = entities.value[entityType].filter(e => String(e.id) !== String(entity.id));
        }
      }
    }
  };

  return {
    entities,
    entitySections,
    expandedSections,
    entityCtx,
    entityCtxStyle,
    entitySelection,
    flatEntityItems,
    loadEntities,
    getEntityName,
    handleEntityClick,
    openEntityCtx,
    toggleSection,
    entitySelectedInSection,
    entityKey,
    deleteEntityCtxNode
  };
}
