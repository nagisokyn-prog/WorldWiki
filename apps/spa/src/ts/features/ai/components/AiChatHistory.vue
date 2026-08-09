<template>
  <div class="chat-history-sidebar">
    <div class="history-header">
      <h3>История чатов</h3>
      <button class="new-chat-btn" @click="createNewChat" title="Новый чат">
        <i class="fas fa-edit"></i>
      </button>
    </div>

    <div class="history-search">
      <input type="text" v-model="searchQuery" class="input-base" placeholder="Поиск чатов...">
    </div>

    <div class="history-list">
      <div v-if="isLoading" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i> Загрузка...
      </div>
      <ExplorerTree
        v-else
        :sections="treeSections"
        :active-id="activeChatId"
        @click-node="handleNodeClick"
        @move-node="handleMoveNode"
      >
        <template #empty-hint>
          <div style="font-size: 11px; text-align: center; margin-top: 10px;">
            Создайте первый чат, чтобы начать
          </div>
        </template>
      </ExplorerTree>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ExplorerTree } from '@worldwiki/components';
import { useAiChats } from '../composables/useAiChats';
import type { AiChatTreeNode } from '../composables/useAiChats';

const props = defineProps({
  activeChatId: String,
  currentProject: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['select-chat', 'new-chat']);

const searchQuery = ref('');

const {
  chats,
  chatTree,
  isLoading,
  loadChats,
  createNewChat,
  updateChatParent
} = useAiChats(props.currentProject);

onMounted(() => {
  loadChats();
});

// Convert our AiChatTree to the format ExplorerTree expects
const buildTreeNodes = (nodes: AiChatTreeNode[]): any[] => {
  return nodes.map(node => ({
    id: node.id,
    label: node.title || 'Новый чат',
    icon: 'fas fa-comment-alt',
    type: 'chat',
    children: node.children && node.children.length > 0 ? buildTreeNodes(node.children) : []
  }));
};

const treeSections = computed(() => {
  let filteredNodes = chatTree.value;

  // Simple flat filter if search query exists
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    const flatChats = chats.value.filter(c => 
      c.title.toLowerCase().includes(q) || 
      (c.tag && c.tag.toLowerCase().includes(q))
    );
    filteredNodes = flatChats.map(c => ({ ...c, children: [] }));
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

const handleNodeClick = (node: any) => {
  emit('select-chat', node.id);
};

const handleMoveNode = (payload: { nodeId: string, newParentId: string }) => {
  if (searchQuery.value) return; // Disallow move while searching
  updateChatParent(payload.nodeId, payload.newParentId);
};
</script>

<style scoped>
.chat-history-sidebar {
  width: 250px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.history-header {
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.history-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.new-chat-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: opacity 0.2s;
}

.new-chat-btn:hover {
  opacity: 0.8;
}

.history-search {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
}

.history-search input {
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.loading-state {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
