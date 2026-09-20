import { ref, computed, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { ChatMessage, MessageVariantGroup } from '../types/aiPanel.model';
import {
  getChatMessages,
  deleteChatMessage as deleteChatMsgApi,
  editChatMessage as editChatMsgApi,
  switchMessageVariant as switchMsgVarApi,
  forkChat as forkChatApi,
} from '../../../services/api.client';

export function useAiMessageTree(options: {
  activeChatId: Ref<string>;
  currentProject: string;
  activeModeSlug: Ref<string>;
  showSidebar: Ref<boolean>;
  loadChats: () => Promise<void>;
  onMessagesLoaded?: () => void;
}) {
  const allMessages = ref<ChatMessage[]>([]);
  const hasError = ref(false);
  const editingMessageId = ref<string | null>(null);
  const editDraft = ref('');

  const loadMessages = async (chatId: string) => {
    try {
      if (!chatId) {
        allMessages.value = [];
        hasError.value = false;
        return;
      }
      const data = (await getChatMessages(chatId)) as Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content?: string;
        reasoning?: string;
        tool_logs?: string[];
        parent_id?: string | null;
        is_active?: boolean;
      }>;

      const loaded: ChatMessage[] = data.map((m) => {
        const isErr =
          m.role === 'assistant' &&
          (m.content?.startsWith('🚫') ||
            m.content?.startsWith('⚠️') ||
            m.content?.startsWith('🔑') ||
            m.content?.startsWith('💳') ||
            m.content?.startsWith('🔍') ||
            m.content?.startsWith('🌐'));
        return {
          id: m.id,
          role: m.role || 'user',
          content: m.content || '',
          reasoning: m.reasoning,
          toolLogs: m.tool_logs,
          parent_id: m.parent_id,
          is_active: m.is_active,
          is_error: Boolean(isErr),
        };
      });

      allMessages.value = loaded;
      const lastMsg = loaded[loaded.length - 1];
      hasError.value = Boolean(lastMsg?.is_error);
      options.onMessagesLoaded?.();
    } catch (err) {
      console.error('Failed to load chat messages:', err);
      allMessages.value = [];
      hasError.value = false;
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!msgId || msgId.startsWith('temp_')) return;
    try {
      await deleteChatMsgApi(msgId);
      allMessages.value = allMessages.value.filter((m) => m.id !== msgId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const editMessage = async (msgId: string, newContent: string) => {
    if (!msgId || msgId.startsWith('temp_') || !newContent.trim() || !options.activeChatId.value) return;
    try {
      await editChatMsgApi(
        msgId,
        newContent,
        options.activeChatId.value,
        options.currentProject,
        options.activeModeSlug.value || null
      );
      const msg = allMessages.value.find((m) => m.id === msgId);
      if (msg) msg.content = newContent;
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const switchVariant = async (msgId: string) => {
    try {
      await switchMsgVarApi(msgId);
      if (options.activeChatId.value) {
        await loadMessages(options.activeChatId.value);
      }
    } catch (err) {
      console.error('Failed to switch variant:', err);
    }
  };

  const renderedMessages = computed<MessageVariantGroup[]>(() => {
    const raw = allMessages.value;
    if (!raw.length) return [];

    const parentMap = new Map<string | null, ChatMessage[]>();
    for (const msg of raw) {
      const pid = msg.parent_id !== undefined ? msg.parent_id : null;
      if (!parentMap.has(pid)) parentMap.set(pid, []);
      parentMap.get(pid)!.push(msg);
    }

    const groups: MessageVariantGroup[] = [];
    let currentParent: string | null = null;
    const visited = new Set<string>();
    let maxSteps = raw.length + 10;

    while (currentParent !== undefined && parentMap.has(currentParent) && maxSteps-- > 0) {
      if (currentParent && visited.has(currentParent)) {
        console.warn('[useAiMessageTree] Cycle detected in message parent_id tree:', currentParent);
        break;
      }
      if (currentParent) visited.add(currentParent);

      const children: ChatMessage[] = parentMap.get(currentParent) || [];
      if (!children.length) break;

      const activeIdx = children.findIndex((c: ChatMessage) => c.is_active !== false);
      const chosenIdx = activeIdx >= 0 ? activeIdx : children.length - 1;
      const activeMsg: ChatMessage = { ...children[chosenIdx] };

      if (activeMsg.content && activeMsg.content.includes('<think>')) {
        const thinkMatch = activeMsg.content.match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/);
        if (thinkMatch) {
          activeMsg.reasoning = thinkMatch[1].trim();
          activeMsg.content = thinkMatch[2].trim();
        } else {
          const openThinkMatch = activeMsg.content.match(/^<think>([\s\S]*)$/);
          if (openThinkMatch) {
            activeMsg.reasoning = openThinkMatch[1].trim();
            activeMsg.content = '';
          }
        }
      }

      groups.push({
        variants: children,
        activeIndex: chosenIdx,
        activeMessage: activeMsg,
      });

      const nextParent = activeMsg.id ?? null;
      if (!nextParent || nextParent === currentParent) break;
      currentParent = nextParent;
    }

    return groups.length > 0 ? groups : raw.map((msg) => ({ variants: [msg], activeIndex: 0, activeMessage: msg }));
  });

  const startEdit = (msg: ChatMessage) => {
    editingMessageId.value = msg.id || null;
    editDraft.value = msg.content;
  };

  const cancelEdit = () => {
    editingMessageId.value = null;
    editDraft.value = '';
  };

  const saveEdit = (id: string) => {
    if (editDraft.value.trim() && id) {
      void editMessage(id, editDraft.value);
    }
    cancelEdit();
  };

  const handleBranch = async (messageId: string | undefined) => {
    const { appAlert } = await import('@worldwiki/components');
    if (!messageId) {
      appAlert('Это сообщение пока не имеет ID для ветвления.');
      return;
    }
    try {
      const newChat = (await forkChatApi(
        options.currentProject,
        messageId,
        'Новая ветка'
      )) as { id?: string } | null;

      if (newChat && newChat.id) {
        options.activeChatId.value = newChat.id;
      }

      await options.loadChats();

      const wasOpen = options.showSidebar.value;
      if (wasOpen) {
        options.showSidebar.value = false;
        void nextTick(() => {
          options.showSidebar.value = true;
        });
      }
    } catch (err) {
      console.error('Failed to branch chat:', err);
      appAlert('Ошибка при ветвлении чата: ' + err);
    }
  };

  return {
    allMessages,
    messages: allMessages,
    hasError,
    editingMessageId,
    editDraft,
    renderedMessages,
    loadMessages,
    deleteMessage,
    editMessage,
    switchVariant,
    startEdit,
    cancelEdit,
    saveEdit,
    handleBranch,
  };
}
