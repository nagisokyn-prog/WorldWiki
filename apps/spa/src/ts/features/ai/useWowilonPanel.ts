import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import MarkdownIt from 'markdown-it';
import type { AiTopBarMode } from './components';
import { useAiChats } from './composables/useAiChats';
import { useAiProfiles } from './composables/useAiProfiles';
import { useAiPanelLayout } from './composables/useAiPanelLayout';
import { useAiContextSelection } from './composables/useAiContextSelection';
import { useAiMessageTree } from './composables/useAiMessageTree';
import { useAiStreamExecution } from './composables/useAiStreamExecution';
import type { WowilonPanelProps, WowilonPanelEmits, ChatMessage, MessageVariantGroup } from './types/aiPanel.model';
import type { AiSkillItem } from './skills/aiSkills.model';
import { DEFAULT_BUILTIN_SKILLS } from './skills/defaultBuiltinSkills';
import { projectRecordId } from '@/services/api/project.api';

export type { ChatMessage, MessageVariantGroup, WowilonPanelProps, WowilonPanelEmits };
export type UseWowilonPanelReturn = ReturnType<typeof useWowilonPanel>;

export function useWowilonPanel(
  props: WowilonPanelProps,
  emit: WowilonPanelEmits
) {
  let currentProject = 'global';
  const hash = window.location.hash;
  if (hash.includes('?')) {
    const hashParams = new URLSearchParams(hash.split('?')[1]);
    const p = hashParams.get('project');
    if (p) currentProject = projectRecordId(p);
  } else {
    const searchParams = new URLSearchParams(window.location.search);
    const p = searchParams.get('project');
    if (p) currentProject = projectRecordId(p);
  }

  const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
  const messagesListRef = ref<{ containerRef: HTMLElement | null } | null>(null);
  const messagesContainer = computed(() => messagesListRef.value?.containerRef || null);
  const chatInputRef = ref<{ unlock: () => void; focus: () => void } | null>(null);

  const skills = ref<AiSkillItem[]>([...DEFAULT_BUILTIN_SKILLS]);

  const {
    chats,
    chatTree,
    activeChatId,
    isLoading: isChatsLoading,
    loadChats,
    createNewChat,
    updateChatParent,
    renameChat,
    deleteChats
  } = useAiChats(currentProject);

  const { activeProfile, loadProfiles } = useAiProfiles(currentProject);

  const activeModeSlug = ref(localStorage.getItem(`worldwiki_ai_active_mode_${currentProject}`) || 'chat');
  const modes = ref<AiTopBarMode[]>([]);
  watch(activeModeSlug, (m) => localStorage.setItem(`worldwiki_ai_active_mode_${currentProject}`, m));

  const handleModeChange = (mode: string) => {
    activeModeSlug.value = mode;
  };

  const loadSkills = async () => {
    try {
      const res = await invoke<AiSkillItem[]>('get_aiskills', { project: currentProject }).catch(() => null);
      if (res && res.length > 0) {
        const builtinMap = new Map<string, AiSkillItem>(DEFAULT_BUILTIN_SKILLS.map((s) => [s.id, s]));
        const merged: AiSkillItem[] = [];
        for (const item of res) {
          if (builtinMap.has(item.id)) {
            const def = builtinMap.get(item.id)!;
            merged.push({
              ...def,
              ...item,
              triggers: item.triggers && item.triggers.length > 0 ? item.triggers : def.triggers
            });
            builtinMap.delete(item.id);
          } else {
            merged.push(item);
          }
        }
        for (const def of builtinMap.values()) {
          merged.unshift(def);
        }
        skills.value = merged;
      } else {
        skills.value = [...DEFAULT_BUILTIN_SKILLS];
      }
    } catch {
      skills.value = [...DEFAULT_BUILTIN_SKILLS];
    }
  };

  const scrollToBottom = () => {
    void nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  };

  const saveScroll = () => {
    if (messagesContainer.value && activeChatId.value) {
      localStorage.setItem(`worldwiki_ai_scroll_${activeChatId.value}`, String(messagesContainer.value.scrollTop));
    }
  };

  const restoreScroll = () => {
    void nextTick(() => {
      if (messagesContainer.value && activeChatId.value) {
        const saved = localStorage.getItem(`worldwiki_ai_scroll_${activeChatId.value}`);
        if (saved !== null) {
          messagesContainer.value.scrollTop = parseFloat(saved);
        } else {
          scrollToBottom();
        }
      }
    });
  };

  const layout = useAiPanelLayout({
    emitClose: () => emit('close'),
    activeChatId,
    currentProject,
    onSettingsClosed: () => {
      void loadSkills();
    }
  });

  const contextSelection = useAiContextSelection({
    onFocusInput: () => chatInputRef.value?.focus?.(),
    onCloseToolInspector: () => {
      layout.isToolInspectorOpen.value = false;
    }
  });

  const messageTree = useAiMessageTree({
    activeChatId,
    currentProject,
    activeModeSlug,
    showSidebar: layout.showSidebar,
    loadChats,
    onMessagesLoaded: () => restoreScroll()
  });

  const streamExecution = useAiStreamExecution({
    activeChatId,
    currentProject,
    activeModeSlug,
    allMessages: messageTree.allMessages,
    renderedMessages: messageTree.renderedMessages,
    skills,
    activeQuote: contextSelection.activeQuote,
    chats,
    loadChats,
    loadMessages: messageTree.loadMessages,
    scrollToBottom,
    chatInputRef
  });

  const findChatInTree = (nodes: typeof chatTree.value, id: string): typeof chatTree.value[0] | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const match = findChatInTree(node.children, id);
        if (match) return match;
      }
    }
    return undefined;
  };

  const syncTokenUsageForChat = (chatId: string | null | undefined) => {
    if (chatId) {
      const found = findChatInTree(chatTree.value, chatId);
      if (found && found.token_usage) {
        streamExecution.tokenUsage.value = {
          input_tokens: found.token_usage.input_tokens || 0,
          output_tokens: found.token_usage.output_tokens || 0,
          total_tokens: found.token_usage.total_tokens || 0,
        };
      }
    }
  };

  watch(activeChatId, (newId) => {
    if (newId) {
      syncTokenUsageForChat(newId);
      if (streamExecution.isGenerating.value && messageTree.allMessages.value.length > 0) {
        return;
      }
      void messageTree.loadMessages(newId).then(() => {
        restoreScroll();
      });
    } else {
      streamExecution.tokenUsage.value = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      messageTree.allMessages.value = [];
    }
  }, { immediate: true });

  watch(chatTree, () => {
    if (activeChatId.value) {
      syncTokenUsageForChat(activeChatId.value);
    }
  }, { deep: true });

  watch(() => props.isOpen, (newVal) => {
    if (newVal && !activeChatId.value) {
      void createNewChat();
    }
  });

  watch(() => messageTree.allMessages.value.length, () => {
    scrollToBottom();
  });

  const renderMarkdown = (text: string) => md.render(text);
  const getChatTitle = (chatId: string): string => chatId.replace('chats:', '');
  const selectChat = (id: string) => {
    activeChatId.value = id;
  };

  onMounted(async () => {
    await loadChats();
    loadProfiles();
    void loadSkills();

    try {
      const res = await invoke<AiTopBarMode[]>('get_aimodes', { project: currentProject });
      if (res && res.length > 0) {
        modes.value = res;
      } else {
        modes.value = [{ slug: 'chat', name: 'Собеседник' }, { slug: 'edit', name: 'Редактор' }, { slug: 'analyze', name: 'Аналитик' }];
      }
    } catch {
      modes.value = [{ slug: 'chat', name: 'Собеседник' }, { slug: 'edit', name: 'Редактор' }, { slug: 'analyze', name: 'Аналитик' }];
    }
  });

  const setMessagesListRef = (el: unknown) => {
    messagesListRef.value = el as { containerRef: HTMLElement | null } | null;
  };

  const setChatInputRef = (el: unknown) => {
    chatInputRef.value = el as { unlock: () => void; focus: () => void } | null;
  };

  return {
    ...layout,
    ...contextSelection,
    ...messageTree,
    ...streamExecution,
    activeProfile,
    activeModeSlug,
    modes,
    skills,
    loadSkills,
    chatTree,
    activeChatId,
    isChatsLoading,
    currentProject,
    messagesListRef,
    chatInputRef,
    setMessagesListRef,
    setChatInputRef,
    handleModeChange,
    createNewChat,
    updateChatParent,
    renameChat,
    deleteChats,
    selectChat,
    renderMarkdown,
    getChatTitle,
    saveScroll,
    scrollToBottom,
    closePanel: () => emit('close')
  };
}
