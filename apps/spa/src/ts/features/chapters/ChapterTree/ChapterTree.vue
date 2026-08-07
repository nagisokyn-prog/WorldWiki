<template>
  <div class="chapter-tree-wrapper" style="height: 100%; display: flex; flex-direction: column;">
    <GlobalCalendarWidget v-if="project" :project="project" />
    <ExplorerTree
      ref="explorerTreeRef"
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
      @edit-section="(sectionId: any) => $emit('edit-schema', sectionId)"
      @delete-section="handleDeleteSection"
    >
      <template #header-actions>
        <button class="tree-action-btn" title="Редактор сущностей (Sandbox)" style="background: transparent; border: none; color: var(--text-main); cursor: pointer; opacity: 0.5; font-size: 14px; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" @click="$emit('open-sandbox')">
          <i class="fas fa-puzzle-piece"></i>
        </button>
      </template>

      <!-- Контекстное меню -->
      <template #context-menu="{ node, close }">
        <template v-if="node.data?.type === 'chapter'">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
        </template>
        
        <template v-else-if="node.data?.type === 'volume'">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="console.error('🔥🔥🔥 ChapterTree: CREATE ARC IN VOLUME', node.id); handleCreate({ sectionId: 'manuscript', parentId: node.id }); close()">
            <span class="ctx-label"><i class="fas fa-layer-group ctx-icon"></i> Добавить арку</span>
          </div>
          <div class="ctx-item" @click="console.error('🔥🔥🔥 ChapterTree: CREATE CHAPTER IN VOLUME', node.id); $emit('create-chapter-in', { arcId: null, volumeId: node.id }); close()">
            <span class="ctx-label"><i class="fas fa-file-alt ctx-icon"></i> Добавить главу</span>
          </div>
        </template>
        
        <template v-else-if="node.data?.type === 'arc'">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="console.error('🔥🔥🔥 ChapterTree: CREATE CHAPTER IN ARC', node.id); handleCreateInline({ sectionId: 'manuscript', parentId: node.id }); close()">
            <span class="ctx-label"><i class="fas fa-file-alt ctx-icon"></i> Добавить главу</span>
          </div>
        </template>
        
        <template v-else-if="node.data?.isEntity">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="handleOpen(node); close()">
            <span class="ctx-label"><i class="fas fa-edit ctx-icon"></i> Открыть / редактировать</span>
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
import { ref } from 'vue';
import { ExplorerTree } from '@worldwiki/components';
import GlobalCalendarWidget from '../../timeline/Calendars/GlobalCalendarWidget/GlobalCalendarWidget.vue';
import { useChapterTree } from './useChapterTree';

const props = defineProps({
  project: { type: String, required: true },
  activeNode: { type: Object, default: null },
  activeEditorId: { type: String, default: null }
});

const emit = defineEmits([
  'select-node', 'select-chapter', 'create-chapter-in', 'rename-chapter', 'delete-chapter',
  'open-entity', 'add-entity', 'rename-entity', 'delete-entity', 'delete-volume', 'delete-arc', 'open-sandbox', 'edit-schema'
]);

const {
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
} = useChapterTree(props, emit);

defineExpose({ load });
</script>

<style scoped src="./ChapterTree.style.css"></style>
