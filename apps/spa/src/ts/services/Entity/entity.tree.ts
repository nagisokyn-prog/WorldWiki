/**
 * @file entity.tree.ts
 * @description Composable for managing entity tree state
 */

import { ref, computed } from 'vue';
import { entityApi } from './entity.api';
import { useTreeSelection } from '@worldwiki/components';

export function useEntityTree(project: string, emit: any) {
  const entities = ref<Record<string, any[]>>({});
  const entitySections = ref<any[]>([]);
  const expandedSections = ref<Set<string>>(new Set(['manuscript']));
  const titleFields = ref<Record<string, string>>({});

  const entityKey = (type: string, id: any) => `entity:${type}:${id}`;
  const entityCtx = ref(null as any);

  const entityCtxStyle = computed(() => {
    if (!entityCtx.value) return {};
    const x = entityCtx.value.x + 220 > window.innerWidth ? entityCtx.value.x - 220 : entityCtx.value.x;
    const y = entityCtx.value.y + 120 > window.innerHeight ? entityCtx.value.y - 120 : entityCtx.value.y;
    return { top: y + 'px', left: x + 'px' };
  });

  const flatEntityItems = computed(() => {
    const result: any[] = [];
    for (const sect of entitySections.value) {
      if (!expandedSections.value.has(sect.type)) continue;
      for (const entity of entities.value[sect.type] || []) {
        result.push({ id: entityKey(sect.type, entity.id), _entity: entity, _type: sect.type });
      }
    }
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

      // Remove from local state immediately
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

  const loadEntities = async () => {
    try {
      const schemas = await entityApi.getSchemas(project);

      entitySections.value = Object.keys(schemas).map(key => ({
        type: key,
        title: schemas[key].name || key,
        emoji: schemas[key].icon || schemas[key].iconEmoji || '📄'
      }));

      titleFields.value = {};
      for (const [key, schema] of Object.entries(schemas)) {
        if ((schema as any).titleField) {
          titleFields.value[key] = (schema as any).titleField;
        }
      }

      for (const sect of entitySections.value) {
        entities.value[sect.type] = await entityApi.getEntityList(project, sect.type);
      }
    } catch (e) {
      console.error('Ошибка загрузки сущностей', e);
    }
  };

  // Хелпер для получения значения по пути "key1.key2"
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
    if (expandedSections.value.has(section)) {
      expandedSections.value.delete(section);
      const keys = [...entitySelection.selected.value].filter((k: any) => String(k).startsWith(`entity:${section}:`));
      if (keys.length > 0) {
        entitySelection.selected.value = new Set([...entitySelection.selected.value].filter((k: any) => !String(k).startsWith(`entity:${section}:`)));
      }
    } else {
      expandedSections.value.add(section);
    }
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
