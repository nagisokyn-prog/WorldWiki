import { ref, computed, onUnmounted } from 'vue';
import type { AiChatTreeNode } from '../../../composables/useAiChats';

export interface HistoryTreeNode {
  id: string;
  label: string;
  icon: string;
  type: string;
  children: HistoryTreeNode[];
}

export interface AiChatHistoryProps {
  chatTree: AiChatTreeNode[];
  activeChatId?: string;
  isLoading?: boolean;
}

export interface AiChatHistoryEmits {
  (e: 'select-chat', chat: string): void;
  (e: 'new-chat'): void;
  (e: 'move-chat', nodeId: string, newParentId: string): void;
  (e: 'rename-chat', id: string, newName: string): void;
  (e: 'delete-chats', ids: string[]): void;
  (e: 'toggle'): void;
}

export function useAiChatHistory(
  props: AiChatHistoryProps,
  emit: AiChatHistoryEmits
) {
  const searchQuery = ref('');
  const explorerTreeRef = ref<{ startRename: (node: { id: string }) => void } | null>(null);

  const getInitialWidth = (): number => {
    const saved = localStorage.getItem('worldwiki_ai_history_sidebar_width');
    return saved ? Math.max(180, Math.min(500, parseInt(saved, 10))) : 250;
  };
  const sidebarWidth = ref<number>(getInitialWidth());
  let resizeCleanup: (() => void) | null = null;

  const startSidebarResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startW = sidebarWidth.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newW = Math.max(180, Math.min(500, startW + delta));
      sidebarWidth.value = newW;
      localStorage.setItem('worldwiki_ai_history_sidebar_width', String(newW));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      resizeCleanup = null;
    };

    resizeCleanup = onMouseUp;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  onUnmounted(() => {
    if (resizeCleanup) {
      resizeCleanup();
    }
  });

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
    let filteredNodes = props.chatTree || [];

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
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
      searchDeep(filteredNodes);
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
    if (searchQuery.value) return;
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

  return {
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
  };
}
