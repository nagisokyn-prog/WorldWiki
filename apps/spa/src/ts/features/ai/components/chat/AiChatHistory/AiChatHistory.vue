<template>
  <div class="chat-history-sidebar" :style="{ width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' }">
    <div class="history-header">
      <div class="history-header-title">
        <button class="history-toggle-btn" title="Свернуть панель истории" @click="$emit('toggle')">
          <i class="fas fa-chevron-left"></i>
        </button>
        <h3>История чатов</h3>
      </div>
      <button class="new-chat-btn" title="Новый чат" @click="createNewChat">
        <i class="fas fa-edit"></i>
      </button>
    </div>

    <div class="history-search">
      <input v-model="searchQuery" type="text" class="input-base" placeholder="Поиск чатов...">
    </div>

    <div class="history-list">
      <div v-if="isLoading" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i> Загрузка...
      </div>
      <ExplorerTree
        v-else
        ref="explorerTreeRef"
        :sections="treeSections"
        :active-id="activeChatId"
        @select="handleNodeClick"
        @move-node="handleMoveNode"
        @rename="handleRename"
        @delete="handleDeleteMultiple"
      >
        <template #empty-hint>
          <div class="empty-chat-hint">
            Создайте первый чат, чтобы начать
          </div>
        </template>
        
        <template #context-menu="{ node, close }">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-sep"></div>
          <div class="ctx-danger ctx-item" @click="handleDelete(node.id, close)">
            <span class="ctx-label">
              <i class="fas fa-trash ctx-icon"></i> Удалить
            </span>
            <kbd class="ctx-kbd ctx-kbd-danger">Del</kbd>
          </div>
        </template>
      </ExplorerTree>
    </div>

    <div class="sidebar-resize-handle" @mousedown.prevent="startSidebarResize"></div>
  </div>
</template>

<script setup lang="ts">
import { ExplorerTree } from '@worldwiki/components';
import { 
  useAiChatHistory, 
  type AiChatHistoryProps, 
  type AiChatHistoryEmits,
  type HistoryTreeNode 
} from './useAiChatHistory';

export type { HistoryTreeNode };

const props = withDefaults(defineProps<AiChatHistoryProps>(), {
  activeChatId: undefined,
  isLoading: false
});

const emit = defineEmits<AiChatHistoryEmits>();

const {
  searchQuery,
  explorerTreeRef,
  sidebarWidth,
  treeSections,
  startSidebarResize,
  handleNodeClick,
  createNewChat,
  handleMoveNode,
  startRename,
  handleRename,
  handleDelete,
  handleDeleteMultiple
} = useAiChatHistory(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiChatHistory.css"></style>
