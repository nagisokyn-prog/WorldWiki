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
        ref="explorerTreeRef"
        v-else
        :sections="treeSections"
        :active-id="activeChatId"
        @click-node="handleNodeClick"
        @move-node="handleMoveNode"
        @rename="handleRename"
        @delete="handleDeleteMultiple"
      >
        <template #empty-hint>
          <div style="font-size: 11px; text-align: center; margin-top: 10px;">
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
  updateChatParent,
  renameChat,
  deleteChats
} = useAiChats(props.currentProject);

const explorerTreeRef = ref<any>(null);

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

const startRename = (node: any, closeCtx: Function) => {
  closeCtx();
  explorerTreeRef.value?.startRename(node);
};

const handleRename = (node: any, newName: string) => {
  renameChat(node.id, newName);
};

const handleDelete = async (id: string, closeCtx: Function) => {
  closeCtx();
  const { confirm } = await import('@tauri-apps/plugin-dialog');
  if (await confirm('Вы уверены, что хотите удалить этот чат? Это действие необратимо.')) {
    await deleteChats([id]);
  }
};

const handleDeleteMultiple = async (ids: string[]) => {
  const { confirm } = await import('@tauri-apps/plugin-dialog');
  if (await confirm(`Вы уверены, что хотите удалить выбранные чаты (${ids.length} шт.)? Это действие необратимо.`)) {
    await deleteChats(ids);
  }
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

/* Context Menu styles (same as ChapterTree) */
.ctx-item {
  padding: 6px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-main);
}
.ctx-item:hover {
  background: var(--bg-hover);
}
.ctx-icon {
  width: 16px;
  margin-right: 6px;
  opacity: 0.7;
}
.ctx-kbd {
  font-size: 10px;
  opacity: 0.5;
  background: rgba(255,255,255,0.1);
  padding: 2px 4px;
  border-radius: 4px;
}
.ctx-sep {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}
.ctx-danger {
  color: #ff5555;
}
.ctx-danger .ctx-icon {
  color: #ff5555;
}
</style>
