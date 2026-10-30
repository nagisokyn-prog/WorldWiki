import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as api from '../../services/api.client';
import { entityApi } from '@/services/Entity/entity.api';
import type { EntitySchema } from '../../types/generated/EntitySchema';

export interface FloatingEntityEditorProps {
  project: string;
  entityType: string;
  entityId: string;
  isOpen: boolean;
}

export interface FloatingEntityEditorEmits {
  (e: 'close'): void;
  (e: 'focus'): void;
  (e: 'saved'): void;
}

export function useFloatingEntityEditor(
  props: FloatingEntityEditorProps,
  emit: FloatingEntityEditorEmits
) {
  const loading = ref(true);
  const config = ref<Record<string, unknown> | null>(null);
  const entityData = ref<Record<string, unknown> | null>(null);

  const windowTitle = computed(() => {
    return `Редактор: ${props.entityType.charAt(0).toUpperCase() + props.entityType.slice(1)}`;
  });

  const entityIcon = computed(() => {
    switch (props.entityType) {
      case 'character': return 'fas fa-user-edit';
      case 'location': return 'fas fa-map-marker-alt';
      case 'item': return 'fas fa-box-open';
      default: return 'fas fa-edit';
    }
  });

  const loadData = async () => {
    loading.value = true;
    try {
      const schemas = await api.getEntitySchemas(props.project);
      const foundSchema = schemas ? schemas.find((s: EntitySchema) => s.type_key === props.entityType) : null;
      config.value = foundSchema ? (foundSchema.full_schema as Record<string, unknown>) : null;

      entityData.value = await entityApi.getEntity(props.project, props.entityType, props.entityId);
    } catch (e) {
      console.error('[FloatingEntityEditor] Load error:', e);
    } finally {
      loading.value = false;
    }
  };

  const handleEntityUpdated = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail) return;
    const targetId = String(detail.entityId || detail.id || '');
    const myId = String(props.entityId || '');
    const cleanTarget = targetId.split(':').pop();
    const cleanMy = myId.split(':').pop();
    if (cleanTarget && cleanMy && cleanTarget === cleanMy) {
      void loadData();
    }
  };

  onMounted(async () => {
    await loadData();
    document.addEventListener('ww:tags-updated', handleEntityUpdated);
    document.addEventListener('ww:entity-saved', handleEntityUpdated);
  });

  onUnmounted(() => {
    document.removeEventListener('ww:tags-updated', handleEntityUpdated);
    document.removeEventListener('ww:entity-saved', handleEntityUpdated);
  });

  watch(
    () => [props.entityId, props.entityType, props.isOpen] as const,
    async (
      newVals: readonly [string, string, boolean],
      oldVals?: readonly [string, string, boolean]
    ) => {
      const [newId, newType, newOpen] = newVals;
      const oldId = oldVals?.[0];
      const oldType = oldVals?.[1];
      const oldOpen = oldVals?.[2];
      if (newOpen && (!oldOpen || newId !== oldId || newType !== oldType)) {
        await loadData();
      }
    },
    { immediate: false }
  );

  const handleSave = () => {
    emit('saved');
  };

  const close = () => {
    emit('close');
  };

  return {
    loading,
    config,
    entityData,
    windowTitle,
    entityIcon,
    handleSave,
    close
  };
}
