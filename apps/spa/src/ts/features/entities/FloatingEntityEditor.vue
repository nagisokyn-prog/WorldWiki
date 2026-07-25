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
import EntityEditorVue from '../../features/entities/EntityEditor/EntityEditor.vue';
import { apiService } from '../../services/api.service';

const props = defineProps<{
  project: string;
  entityType: string;
  entityId: string;
  isOpen: boolean;
}>();

const emit = defineEmits(['close', 'focus', 'saved']);

const loading = ref(true);
const config = ref<any>(null);
const entityData = ref<any>(null);

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
    const [oldId, oldType, oldOpen] = oldVals;
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
    const schemas = await apiService.getSchemas(props.project);
    config.value = schemas ? schemas[props.entityType] : null;
    
    // Fetch entity data
    entityData.value = await apiService.getEntity(props.project, props.entityType, props.entityId);
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

<style scoped>
.floating-editor-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
}

.embedded-editor {
  flex: 1;
  overflow: hidden;
}

.loading-overlay, .error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-muted);
}

.loader {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state i {
  font-size: 40px;
  color: #ef4444;
}
</style>

