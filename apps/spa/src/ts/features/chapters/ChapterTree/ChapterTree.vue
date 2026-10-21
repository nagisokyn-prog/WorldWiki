<template>
  <div class="chapter-tree-wrapper">
    <ExplorerTree
      ref="explorerTreeRef"
      class="explorer-tree-flex"
      title="Структура"
      icon="fas fa-book-open"
      :show-back="true"
      :sections="explorerSections"
      storage-key="worldwiki-explorer"
      :active-id="activeId"
      @back="goBack"
      @select="handleSelect"
      @open="handleOpen"
      @create="handleCreate"
      @create-inline="handleCreateInline"
      @rename="handleRename"
      @cancel-rename="handleCancelRename"
      @delete="handleDelete"
      @edit-section="(sectionId) => $emit('edit-schema', sectionId)"
      @delete-section="handleDeleteSection"
    >
      <template #header-actions>
        <button class="tree-action-btn" title="Редактор сущностей (Sandbox)" @click="$emit('open-sandbox')">
          <i class="fas fa-puzzle-piece"></i>
        </button>
      </template>

      <!-- Контекстное меню -->
      <template #context-menu="{ node, close }">
        <template v-if="isNodeType(node, 'chapter')">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
        </template>
        
        <template v-else-if="isNodeType(node, 'volume')">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="console.error('🔥🔥🔥 ChapterTree: CREATE CHAPTER IN VOLUME', node.id); $emit('create-chapter-in', { volumeId: node.id }); close()">
            <span class="ctx-label"><i class="fas fa-file-alt ctx-icon"></i> Добавить главу</span>
          </div>
        </template>
        
        <template v-else-if="isEntityNode(node)">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="handleOpen(node); close()">
            <span class="ctx-label"><i class="fas fa-edit ctx-icon"></i> Открыть / редактировать</span>
          </div>
        </template>

        <template v-else-if="isNodeType(node, 'planet')">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="handleCreate({ sectionId: 'calendars', parentId: node.id, name: 'Новый календарь' }); close()">
            <span class="ctx-label"><i class="fas fa-calendar-plus ctx-icon"></i> Добавить календарь</span>
          </div>
          <div class="ctx-item" @click="handleOpen(node); close()">
            <span class="ctx-label"><i class="fas fa-edit ctx-icon"></i> Открыть настройки планеты</span>
          </div>
        </template>

        <template v-else-if="isNodeType(node, 'calendar')">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="handleOpen(node); close()">
            <span class="ctx-label"><i class="fas fa-edit ctx-icon"></i> Открыть календарь</span>
          </div>
        </template>

        <div class="ctx-sep"></div>

        <div class="ctx-danger ctx-item" @click="handleDelete([node.id]); close()">
          <span class="ctx-label">
            <i class="fas fa-trash ctx-icon"></i> Удалить
          </span>
          <kbd class="ctx-kbd ctx-kbd-danger">Del</kbd>
        </div>
      </template>
    </ExplorerTree>
  </div>
</template>


<script setup lang="ts">
import { ExplorerTree } from '@worldwiki/components';
import { useChapterTree } from './useChapterTree';
import type { ChapterTreeProps } from './ChapterTree.model';

const props = withDefaults(defineProps<ChapterTreeProps>(), {
  activeNode: null,
  activeEditorId: null
});

const emit = defineEmits([
  'select-node', 'select-chapter', 'create-chapter-in', 'rename-chapter', 'delete-chapter',
  'open-entity', 'add-entity', 'rename-entity', 'delete-entity', 'delete-volume', 'open-sandbox', 'edit-schema',
  'open-planet-viewer'
]);

const {
  isNodeType,
  isEntityNode,
  explorerSections,
  activeId,
  explorerTreeRef,
  goBack,
  handleSelect,
  handleOpen,
  startRename,
  handleCreate,
  handleCreateInline,
  handleRename,
  handleCancelRename,
  handleDelete,
  handleDeleteSection,
  load
} = useChapterTree(props, emit as (event: string, ...args: unknown[]) => void);

defineExpose({ load });
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ChapterTree.css"></style>
