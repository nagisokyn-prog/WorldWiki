<template>
  <div class="chat-history-sidebar">
    <div class="history-header">
      <h3>История чатов</h3>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ExplorerTree } from '@worldwiki/components';
import type { AiChatTreeNode } from '../composables/useAiChats';

export interface HistoryTreeNode {
  id: string;
  label: string;
  icon: string;
  type: string;
  children: HistoryTreeNode[];
}

const props = withDefaults(defineProps<{
  chatTree: AiChatTreeNode[];
  activeChatId?: string;
  isLoading?: boolean;
}>(), {
  activeChatId: undefined,
  isLoading: false
});

const emit = defineEmits<{
  (e: 'select-chat', chat: string): void;
  (e: 'new-chat'): void;
  (e: 'move-chat', nodeId: string, newParentId: string): void;
  (e: 'rename-chat', id: string, newName: string): void;
  (e: 'delete-chats', ids: string[]): void;
}>();

const searchQuery = ref('');

const explorerTreeRef = ref<{ startRename: (node: { id: string }) => void } | null>(null);

// Removed onMounted loadChats, WowilonPanel will handle it

// Convert our AiChatTree to the format ExplorerTree expects
const buildTreeNodes = (nodes: AiChatTreeNode[]): HistoryTreeNode[] => {
  return nodes.map(node => ({
    id: node.id,
    label: node.title || 'Новый чат',
    icon: 'fas fa-comment-alt',
    type: 'chat',
    children: node.children && node.children.length > 0 ? buildTreeNodes(node.children) : []
  }));
};

const treeSections = computed(() => {
  let filteredNodes = props.chatTree;

  // Simple flat filter if search query exists
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    
    // Helper to deeply search and flatten matches from the tree
    const flatMatches: AiChatTreeNode[] = [];
    const searchDeep = (nodes: AiChatTreeNode[]) => {
      for (const node of nodes) {
        if (node.title?.toLowerCase().includes(q) || (node.tag && node.tag.toLowerCase().includes(q))) {
          flatMatches.push({ ...node, children: [] });
        }
        if (node.children) {
          searchDeep(node.children);
        }
      }
    };
    searchDeep(props.chatTree);
    filteredNodes = flatMatches;
  }

  return [
    {
      id: 'chats',
      title: 'Чаты',
      icon: 'fas fa-comments',
      nodes: buildTreeNodes(filteredNodes),
      canAdd: false
    }
  ];
});

const handleNodeClick = (nodes: Array<{ id: string }>) => {
  if (nodes && nodes.length > 0) {
    emit('select-chat', nodes[0].id);
  }
};

const createNewChat = () => {
  emit('new-chat');
};

const handleMoveNode = (payload: { nodeId: string, newParentId: string }) => {
  if (searchQuery.value) return; // Disallow move while searching
  emit('move-chat', payload.nodeId, payload.newParentId);
};

const startRename = (node: { id: string }, closeCtx: () => void) => {
  closeCtx();
  explorerTreeRef.value?.startRename(node);
};

const handleRename = (node: { id: string }, newName: string) => {
  emit('rename-chat', node.id, newName);
};

const handleDelete = async (id: string, closeCtx: () => void) => {
  closeCtx();
  const { appConfirm } = await import('@worldwiki/components');
  if (await appConfirm('Вы уверены, что хотите удалить этот чат? Это действие необратимо.')) {
    emit('delete-chats', [id]);
  }
};

const handleDeleteMultiple = async (ids: string[]) => {
  const { appConfirm } = await import('@worldwiki/components');
  if (await appConfirm(`Вы уверены, что хотите удалить выбранные чаты (${ids.length} шт.)? Это действие необратимо.`)) {
    emit('delete-chats', ids);
  }
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiChatHistory.css"></style>
