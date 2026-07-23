/**
 * @file entity.tree.ts
 * @description Composable for managing entity tree state
 */

import { ref, computed, watch } from 'vue';
import { entityApi } from './entity.api';
import { useTreeSelection } from '@worldwiki/components';

export function useEntityTree(project: string, emit: any) {
  const entities = ref<Record<string, any[]>>({});
  const entitySections = ref<any[]>([]);
  const expandedSections = ref<Set<string>>(new Set(['manuscript']));
  const titleFields = ref<Record<string, string>>({});

  const entityKey = (type: string, id: any) => `entity:${type}:${id}`;
  const entityCtx = ref(null as any);

  // DEBUG: watch reactive state changes
  watch(entitySections, (v) => console.log('[TREE DEBUG] entitySections changed:', JSON.stringify(v)), { deep: true });
  watch(entities, (v) => {
    const counts = Object.fromEntries(Object.entries(v).map(([k, a]) => [k, a.length]));
    console.log('[TREE DEBUG] entities changed, counts:', counts);
    for (const [type, list] of Object.entries(v)) {
      if (list.length > 0) {
        console.log(`[TREE DEBUG]   ${type}[0] =`, JSON.stringify(list[0]));
      }
    }
  }, { deep: true });

  const entityCtxStyle = computed(() => {
    if (!entityCtx.value) return {};
    const x = entityCtx.value.x + 220 > window.innerWidth ? entityCtx.value.x - 220 : entityCtx.value.x;
    const y = entityCtx.value.y + 120 > window.innerHeight ? entityCtx.value.y - 120 : entityCtx.value.y;
    return { top: y + 'px', left: x + 'px' };
  });

  const flatEntityItems = computed(() => {
    const result: any[] = [];
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
      if (!confirm(`Удалить выбранные сущности (${keys.length})?`)) return;

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
      const schemas = await entityApi.getSchemas(project);
      console.log('[TREE DEBUG] ← getSchemas returned:', Object.keys(schemas));

      entitySections.value = Object.keys(schemas).map(key => ({
        type: key,
        title: schemas[key].name || key,
        emoji: schemas[key].icon || schemas[key].iconEmoji || '📄'
      }));
      console.log('[TREE DEBUG] entitySections set to:', entitySections.value.map(s => s.type));

      titleFields.value = {};
      for (const [key, schema] of Object.entries(schemas)) {
        if ((schema as any).titleField) {
          titleFields.value[key] = (schema as any).titleField;
        }
      }

      const newEntities: Record<string, any[]> = {};
      for (const sect of entitySections.value) {
        console.log(`[TREE DEBUG] → getEntityList for type='${sect.type}'...`);
        const list = await entityApi.getEntityList(project, sect.type);
        console.log(`[TREE DEBUG] ← getEntityList for '${sect.type}' returned ${list.length} items:`, JSON.stringify(list));
        newEntities[sect.type] = list;
      }
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

  const getValueByPath = (obj: any, path: string): any => {
    if (!path) return undefined;
    return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
  };

  const getEntityName = (entity: any, type: string) => {
    const path = titleFields.value[type];
    if (path) {
      const val = getValueByPath(entity, path);
      if (val) return val;
    }
    return entity.name || 'Без названия';
  };

  const handleEntityClick = (event: MouseEvent, type: string, entity: any, sect: any) => {
    const key = entityKey(type, entity.id);
    entitySelection.handleClick(event, { id: key }, flatEntityItems.value);
    if (!event.ctrlKey && !event.shiftKey && !event.metaKey) {
      emit('open-entity', { ...entity, entityType: type });
    }
  };

  const openEntityCtx = (e: MouseEvent, type: string, entity: any, sect: any) => {
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
      const keys = [...entitySelection.selected.value].filter((k: any) => String(k).startsWith(`entity:${section}:`));
      if (keys.length > 0) {
        entitySelection.selected.value = new Set([...entitySelection.selected.value].filter((k: any) => !String(k).startsWith(`entity:${section}:`)));
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
      if (confirm(`Удалить сущность "${getEntityName(entity, entityType)}"?`)) {
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
