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
import { FloatingWindow } from '@worldwiki/components';
import EntityEditorVue from '@/features/entities/EntityEditor/EntityEditor.vue';
import { 
  useFloatingEntityEditor, 
  type FloatingEntityEditorProps, 
  type FloatingEntityEditorEmits 
} from './useFloatingEntityEditor';

const props = defineProps<FloatingEntityEditorProps>();
const emit = defineEmits<FloatingEntityEditorEmits>();

const {
  loading,
  config,
  entityData,
  windowTitle,
  entityIcon,
  handleSave,
  close
} = useFloatingEntityEditor(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/FloatingEntityEditor.css"></style>
