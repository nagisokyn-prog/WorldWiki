<template>
  <FloatingWindow
    v-if="isOpen"
    :title="windowTitle"
    :is-open="isOpen"
    @close="close"
    @focus="$emit('focus')"
  >
    <template #icon>
      <i :class="entityIcon"></i>
    </template>
    
    <div class="floating-editor-inner">
      <div v-if="loading" class="loading-overlay">
        <div class="loader"></div>
        <span>Загрузка данных...</span>
      </div>
      
      <EntityEditorVue
        v-else-if="config && entityData"
        :project="project"
        :config="config"
        :initial-data="entityData"
        :entity-id="entityId"
        :entity-type="entityType"
        class="embedded-editor"
        @save="handleSave"
      />
      
      <div v-else class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Не удалось загрузить редактор</span>
      </div>
    </div>
  </FloatingWindow>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { FloatingWindow } from '@worldwiki/components';
import EntityEditorVue from './EntityEditor/EntityEditor.vue';
import * as api from '../../services/api.client';
import { entityApi } from '@/services/Entity/entity.api';

const props = defineProps<{
  project: string;
  entityType: string;
  entityId: string;
  isOpen: boolean;
}>();

import type { EntitySchema } from '../../types/generated/EntitySchema';

const emit = defineEmits(['close', 'focus', 'saved']);

const loading = ref(true);
const config = ref<Record<string, unknown> | null>(null);
const entityData = ref<Record<string, unknown> | null>(null);

const windowTitle = computed(() => {
  return `Редактор: ${props.entityType.charAt(0).toUpperCase() + props.entityType.slice(1)}`;
});

const entityIcon = computed(() => {
  switch(props.entityType) {
    case 'character': return 'fas fa-user-edit';
    case 'location': return 'fas fa-map-marker-alt';
    case 'item': return 'fas fa-box-open';
    default: return 'fas fa-edit';
  }
});

onMounted(async () => {
  await loadData();
});

// Reload data when the entity ID, type, or open state changes
watch(
  () => [props.entityId, props.entityType, props.isOpen] as const,
  async (
    newVals: readonly [string, string, boolean],
    oldVals: readonly [string, string, boolean]
  ) => {
    const [newId, newType, newOpen] = newVals;
    const [oldId, oldType] = oldVals;
    // If the editor is opened and any relevant prop changed, reload
    if (newOpen && (newId !== oldId || newType !== oldType)) {
      await loadData();
    }
  },
  { immediate: false }
);

// The previous watch on isOpen caused duplicate loadData calls leading to DOM errors.
// Removed to rely on the combined watch handling entityId, entityType, and isOpen.

const loadData = async () => {
  loading.value = true;
  try {
    // Fetch template
    const schemas = await api.getEntitySchemas(props.project);
    const foundSchema = schemas ? schemas.find((s: EntitySchema) => s.type_key === props.entityType) : null;
    config.value = foundSchema ? (foundSchema.full_schema as Record<string, unknown>) : null;
    
    // Fetch entity data
    entityData.value = await entityApi.getEntity(props.project, props.entityType, props.entityId);
  } catch (e) {
    console.error('[FloatingEntityEditor] Load error:', e);
  } finally {
    loading.value = false;
  }
};

const handleSave = () => {
  emit('saved');
};

const close = () => {
  emit('close');
};
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/FloatingEntityEditor.css"></style>

