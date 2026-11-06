<template>
  <div class="editor-modals-container">
    <!-- Entity Link Selector Modal -->
    <EntityLinkSelector
      :project="project"
      :is-open="isEntitySelectorOpen"
      :initial-query="entitySelectorQuery"
      @close="$emit('close-entity-selector')"
      @insert="$emit('insert-entity', $event)"
    />

    <!-- Promise Context Menu -->
    <PromiseContextMenu
      :is-open="isPromiseMenuOpen"
      :position="promiseMenuPos"
      :existing-promises="existingPromises"
      @close="$emit('close-promise-menu')"
      @select="$emit('select-promise', $event)"
      @link-milestone="$emit('link-milestone', $event)"
    />

    <!-- Document Export Modal -->
    <component
      :is="'DocumentExportModal'"
      v-if="isExportModalOpen"
      :is-open="isExportModalOpen"
      :project-name="project"
      :document="currentSemanticDocument"
      @close="$emit('close-export-modal')"
    />

    <!-- Paragraph Format Modal -->
    <ParagraphFormatModal
      :is-open="isParagraphModalOpen"
      @close="$emit('close-paragraph-modal')"
      @apply="$emit('apply-paragraph-format', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { EditorModalsProps, EditorModalsEmits } from './EditorModals.model';
import EntityLinkSelector from '../../EntityLinkSelector.vue';
import PromiseContextMenu from '../../PromiseContextMenu.vue';
import ParagraphFormatModal from '../../stubs/ParagraphFormatModalStub.vue';

defineProps<EditorModalsProps>();

defineEmits<EditorModalsEmits>();
</script>
