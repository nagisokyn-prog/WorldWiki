import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import MarkdownIt from 'markdown-it';
import type { ToolCallPayload } from './components/AiToolApproval.vue';
import { useAiChats } from './composables/useAiChats';
import { useAiProfiles } from './composables/useAiProfiles';
import type { ContextItem } from './components/AiContextSelector.vue';
import type { AiTopBarMode } from './components/AiChatTopBar.vue';
import {
  getChatMessages,
  sendChatMessage,
  cancelGeneration as cancelGenApi,
  deleteChatMessage as deleteChatMsgApi,
  editChatMessage as editChatMsgApi,
  regenerateChatMessage as regenChatMsgApi,
  switchMessageVariant as switchMsgVarApi,
  forkChat as forkChatApi,
  aiRespondToolApproval
} from '../../services/api.client';

import type { AiSkillItem } from './components/AiSkillAutocomplete.model';

const DEFAULT_BUILTIN_SKILLS: AiSkillItem[] = [
  {
    id: 'ai_skills:entity_type_creator',
    name: 'Конструктор типов сущностей',
    description: 'Пошаговое создание нового типа сущности на базе каталога блоков ui_editor.json с визуализацией через Mermaid MMD диаграмму.',
    prompt_text: 'Ты используешь эталонный навык "Конструктор типов сущностей". Перед созданием структуры всегда строй Mermaid MMD диаграмму вкладок и полей.'
  }
];

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolLogs?: string[];
  toolCallWaiting?: ToolCallPayload | null;
  quoted_context?: {
    selected_text?: string;
    source_message_id?: string;
    source_chat_id?: string;
    range?: [number, number];
  } | null;
  citations?: Array<{
    index: number;
    evidence_id: string;
    page_id?: string;
    url: string;
    domain: string;
    title: string;
    claim_text?: string;
    excerpt: string;
  }> | null;
  parent_id?: string | null;
  is_active?: boolean;
  is_error?: boolean;
}

export interface MessageVariantGroup {
  variants: ChatMessage[];
  activeIndex: number;
  activeMessage: ChatMessage;
}

export interface WowilonPanelProps {
  isOpen: boolean;
}

export interface WowilonPanelEmits {
  (e: 'close'): void;
}

export function useWowilonPanel(
  props: WowilonPanelProps,
  emit: WowilonPanelEmits
) {
  const savedWidth = Number(localStorage.getItem('worldwiki_ai_panel_width') || '400');
  const panelWidth = ref(Number.isNaN(savedWidth) ? 400 : Math.max(300, Math.min(1200, savedWidth)));
  const showSidebar = ref(localStorage.getItem('worldwiki_ai_show_sidebar') === 'true');
  const isSettingsOpen = ref(localStorage.getItem('worldwiki_ai_settings_open') === 'true');
  const isToolInspectorOpen = ref(false);
  const selectedContext = ref<ContextItem[]>([]);
  const skills = ref<AiSkillItem[]>([...DEFAULT_BUILTIN_SKILLS]);

  const activeQuote = ref<{ selected_text: string; source_message_id?: string } | null>(null);
  const researchProgress = ref<{
    stage: 'planning' | 'searching' | 'reading' | 'synthesizing' | 'completed' | 'idle';
    query?: string;
    hitsCount?: number;
    pagesCount?: number;
    evidenceCount?: number;
  }>({ stage: 'idle' });

  const handleAskWoWiLon = (payload: { selected_text: string; source_message_id?: string }) => {
    activeQuote.value = payload;
    chatInputRef.value?.focus?.();
  };

  const handleClearQuote = () => {
    activeQuote.value = null;
  };

  const handleAskSource = (citation: { domain: string; title: string; excerpt: string; url: string }) => {
    activeQuote.value = {
      selected_text: `Источник: ${citation.title} (${citation.domain})\n${citation.excerpt}`,
    };
    chatInputRef.value?.focus?.();
  };

  const handleAddToLore = (text: string) => {
    selectedContext.value = [
      ...selectedContext.value,
      {
        id: `lore_selection_${Date.now()}`,
        title: 'Выделенный фрагмент',
        type: 'manual',
        content: text,
      },
    ];
  };

  const loadSkills = async () => {
    try {
      const res = await invoke<AiSkillItem[]>('get_aiskills', {
        project: currentProject
      }).catch(() => null);

      if (res && res.length > 0) {
        skills.value = res;
      } else {
        skills.value = [...DEFAULT_BUILTIN_SKILLS];
      }
    } catch {
      skills.value = [...DEFAULT_BUILTIN_SKILLS];
    }
  };

  watch(panelWidth, (w) => localStorage.setItem('worldwiki_ai_panel_width', String(w)));
  watch(showSidebar, (v) => localStorage.setItem('worldwiki_ai_show_sidebar', String(v)));
  watch(isSettingsOpen, (v) => {
    localStorage.setItem('worldwiki_ai_settings_open', String(v));
    if (!v) {
      void loadSkills();
    }
  });
  watch(isToolInspectorOpen, (v) => console.log('🔥🔥🔥 [useWowilonPanel] isToolInspectorOpen changed to:', v));

  let currentProject = 'global';
  const hash = window.location.hash;
  if (hash.includes('?')) {
    const hashParams = new URLSearchParams(hash.split('?')[1]);
    const p = hashParams.get('project');
    if (p) currentProject = p.includes(':') ? p : `projects:${p}`;
  } else {
    const searchParams = new URLSearchParams(window.location.search);
    const p = searchParams.get('project');
    if (p) currentProject = p.includes(':') ? p : `projects:${p}`;
  }

  const md = new MarkdownIt({ html: true, breaks: true, linkify: true });

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

  const handleModeChange = (mode: string) => {
    activeModeSlug.value = mode;
  };

  const toggleSidebar = () => {
    showSidebar.value = !showSidebar.value;
  };

  watch(activeModeSlug, (m) => localStorage.setItem(`worldwiki_ai_active_mode_${currentProject}`, m));

  const allMessages = ref<ChatMessage[]>([]);
  const isGenerating = ref(false);
  const hasError = ref(false);
  const tokenUsage = ref({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  let unlistenChunk: UnlistenFn | null = null;
  let unlistenApproval: UnlistenFn | null = null;

  const editingMessageId = ref<string | null>(null);
  const editDraft = ref('');
  const isSending = ref(false);

  const messagesListRef = ref<{ containerRef: HTMLElement | null } | null>(null);
  const messagesContainer = computed(() => messagesListRef.value?.containerRef || null);
  const chatInputRef = ref<{ unlock: () => void; focus: () => void } | null>(null);

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
      const loaded: ChatMessage[] = data.map(m => {
        const isErr = m.role === 'assistant' && (
          m.content?.startsWith('🚫') ||
          m.content?.startsWith('⚠️') ||
          m.content?.startsWith('🔑') ||
          m.content?.startsWith('💳') ||
          m.content?.startsWith('🔍') ||
          m.content?.startsWith('🌐')
        );
        return {
          id: m.id,
          role: m.role || 'user',
          content: m.content || '',
          reasoning: m.reasoning,
          toolLogs: m.tool_logs,
          parent_id: m.parent_id,
          is_active: m.is_active,
          is_error: Boolean(isErr)
        };
      });
      allMessages.value = loaded;
      const lastMsg = loaded[loaded.length - 1];
      hasError.value = Boolean(lastMsg?.is_error);
    } catch (err) {
      console.error('Failed to load chat messages:', err);
      allMessages.value = [];
      hasError.value = false;
    }
  };

  const cancelGeneration = async () => {
    try {
      if (activeChatId.value) {
        await cancelGenApi(activeChatId.value);
      }
    } catch (err) {
      console.error('Failed to cancel generation:', err);
    } finally {
      isGenerating.value = false;
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!msgId || msgId.startsWith('temp_')) return;
    try {
      await deleteChatMsgApi(msgId);
      allMessages.value = allMessages.value.filter(m => m.id !== msgId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const editMessage = async (msgId: string, newContent: string) => {
    if (!msgId || msgId.startsWith('temp_') || !newContent.trim() || !activeChatId.value) return;
    try {
      await editChatMsgApi(msgId, newContent, activeChatId.value, currentProject, activeModeSlug.value || null);
      const msg = allMessages.value.find(m => m.id === msgId);
      if (msg) msg.content = newContent;
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const regenerateMessage = async (msgId: string) => {
    if (!activeChatId.value) return;
    try {
      isGenerating.value = true;
      await regenChatMsgApi(msgId, activeChatId.value, currentProject, activeModeSlug.value || null);
    } catch (err) {
      console.error('Failed to regenerate message:', err);
      isGenerating.value = false;
    }
  };

  const switchVariant = async (msgId: string) => {
    try {
      await switchMsgVarApi(msgId);
      if (activeChatId.value) {
        await loadMessages(activeChatId.value);
      }
    } catch (err) {
      console.error('Failed to switch variant:', err);
    }
  };

  const triggerSend = async (text: string) => {
    if (!text.trim()) return;
    const currentChatId = activeChatId.value || 'new';
    isGenerating.value = true;

    // Определяем родителя: ID последнего активного сообщения в текущей ветке
    const lastGroup = renderedMessages.value[renderedMessages.value.length - 1];
    const parentId = lastGroup?.activeMessage?.id ?? (allMessages.value.length > 0 ? allMessages.value[allMessages.value.length - 1].id ?? null : null);

    // Индекс только что добавленного user-сообщения — обновим id после ответа
    const userMsgIdx = allMessages.value.length;
    allMessages.value.push({
      role: 'user',
      content: text,
      parent_id: parentId
    });

    let messageToSend = text;
    const skillMatches = Array.from(text.matchAll(/!"([^"]+)"/g));
    if (skillMatches.length > 0) {
      const skillContexts: string[] = [];
      for (const match of skillMatches) {
        const skillName = match[1].trim();
        const skill = skills.value.find(s => s.name.toLowerCase() === skillName.toLowerCase());
        if (skill) {
          let skillContent = skill.prompt_text || skill.description || '';
          if (skillName.toLowerCase().includes('конструктор') && !skillContent.includes('## 🛑 Железные Инварианты')) {
            try {
              const res = await fetch('/skills/Конструктор_типов_сущностей.md');
              if (res.ok) {
                skillContent = await res.text();
              }
            } catch {
              // fallback
            }
          }
          skillContexts.push(`<context type="skill" name="${skill.name}">\n${skillContent}\n</context>`);
        }
      }
      if (skillContexts.length > 0) {
        messageToSend = `${skillContexts.join('\n\n')}\n\n${text}`;
      }
    }

    if (activeQuote.value) {
      messageToSend = `[Цитата]: «${activeQuote.value.selected_text}»\n\n${messageToSend}`;
      activeQuote.value = null;
    }

    try {
      const res = (await sendChatMessage(
        currentChatId,
        messageToSend,
        currentProject,
        activeModeSlug.value || null
      )) as {
        chat_id?: string;
        assistant_msg_id?: string;
        user_msg_id?: string;
      } | null;

      if (res && res.chat_id) {
        // 1. Устанавливаем activeChatId ДО добавления assistant-placeholder,
        //    чтобы watch-guard (isGenerating && length > 0) не затёр allMessages.
        activeChatId.value = res.chat_id;

        // 2. Проставляем реальный id user-сообщению (для корректного дерева вариантов).
        if (res.user_msg_id && allMessages.value[userMsgIdx]) {
          allMessages.value[userMsgIdx] = {
            ...allMessages.value[userMsgIdx],
            id: res.user_msg_id,
            parent_id: parentId
          };
        }

        // 3. Добавляем placeholder ассистента с реальным id и parent_id = user_msg_id,
        //    чтобы stream listener нашёл его по chunk.message_id.
        if (res.assistant_msg_id) {
          allMessages.value.push({
            id: res.assistant_msg_id,
            role: 'assistant',
            content: '',
            parent_id: res.user_msg_id ?? null
          });
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      isGenerating.value = false;
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
        console.warn('[useWowilonPanel] Cycle detected in message parent_id tree:', currentParent);
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
        activeMessage: activeMsg
      });

      const nextParent = activeMsg.id ?? null;
      if (!nextParent || nextParent === currentParent) break;
      currentParent = nextParent;
    }

    return groups.length > 0 ? groups : raw.map(msg => ({ variants: [msg], activeIndex: 0, activeMessage: msg }));
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
        tokenUsage.value = {
          input_tokens: found.token_usage.input_tokens || 0,
          output_tokens: found.token_usage.output_tokens || 0,
          total_tokens: found.token_usage.total_tokens || 0,
        };
      }
    }
  };

  watch(activeChatId, (newId) => {
    if (newId) {
      const found = findChatInTree(chatTree.value, newId);
      if (found && found.token_usage) {
        tokenUsage.value = {
          input_tokens: found.token_usage.input_tokens || 0,
          output_tokens: found.token_usage.output_tokens || 0,
          total_tokens: found.token_usage.total_tokens || 0,
        };
      } else {
        tokenUsage.value = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      }
      if (isGenerating.value && allMessages.value.length > 0) {
        return;
      }
      void loadMessages(newId).then(() => {
        restoreScroll();
      });
    } else {
      tokenUsage.value = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      allMessages.value = [];
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

  watch(() => allMessages.value.length, () => {
    scrollToBottom();
  });

  const renderMarkdown = (text: string) => {
    return md.render(text);
  };

  const getChatTitle = (chatId: string): string => {
    return chatId.replace('chats:', '');
  };

  const closePanel = () => {
    emit('close');
  };

  const sendMessage = async (text: string) => {
    if (isSending.value || isGenerating.value || !text.trim()) return;

    isSending.value = true;
    try {
      await triggerSend(text);
      await loadChats();
      scrollToBottom();
    } finally {
      isSending.value = false;
      chatInputRef.value?.unlock();
    }
  };

  const selectChat = (id: string) => {
    activeChatId.value = id;
  };

  const handleBranch = async (messageId: string | undefined) => {
    const { appAlert } = await import('@worldwiki/components');
    if (!messageId) {
      appAlert('Это сообщение пока не имеет ID для ветвления.');
      return;
    }
    try {
      const newChat = (await forkChatApi(
        currentProject,
        messageId,
        'Новая ветка'
      )) as { id?: string } | null;

      if (newChat && newChat.id) {
        activeChatId.value = newChat.id;
      }

      await loadChats();

      const wasOpen = showSidebar.value;
      if (wasOpen) {
        showSidebar.value = false;
        void nextTick(() => {
          showSidebar.value = true;
        });
      }
    } catch (err) {
      console.error('Failed to branch chat:', err);
      appAlert('Ошибка при ветвлении чата: ' + err);
    }
  };

  const handleContextSelected = (contexts: ContextItem[]) => {
    selectedContext.value = [...selectedContext.value, ...contexts];
  };

  const handleInsertContext = (text: string) => {
    const newItem: ContextItem = {
      id: `manual_tool_${Date.now()}`,
      title: 'Ручной вызов инструмента',
      type: 'manual',
      content: text
    };
    selectedContext.value = [...selectedContext.value, newItem];
    isToolInspectorOpen.value = false;
  };

  const removeContext = (ctx: ContextItem) => {
    selectedContext.value = selectedContext.value.filter(c => c.id !== ctx.id);
  };

  const handleToolApproval = async (data: { toolCallId?: string; approved?: boolean } | unknown) => {
    const payload = data as { toolCallId?: string; approved?: boolean };
    const callId = payload?.toolCallId;
    if (callId) {
      try {
        await aiRespondToolApproval(callId, true);
      } catch (err) {
        console.error('Failed to approve tool call:', err);
      }
      const msg = allMessages.value.find(m => m.toolCallWaiting?.tool_call_id === callId);
      if (msg) {
        msg.toolCallWaiting = null;
      }
    }
  };

  const handleToolRejection = async (data: { toolCallId?: string; approved?: boolean; feedback?: string } | unknown) => {
    const payload = data as { toolCallId?: string; approved?: boolean; feedback?: string };
    const callId = payload?.toolCallId;
    if (callId) {
      try {
        await aiRespondToolApproval(callId, false);
      } catch (err) {
        console.error('Failed to reject tool call:', err);
      }
      const msg = allMessages.value.find(m => m.toolCallWaiting?.tool_call_id === callId);
      if (msg) {
        msg.toolCallWaiting = null;
      }
    }
  };

  const startResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startWidth = panelWidth.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(800, startWidth + delta));
      panelWidth.value = newWidth;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const detachWindow = async () => {
    emit('close');
    try {
      const params = new URLSearchParams();
      if (activeChatId.value) params.set('chatId', activeChatId.value);
      if (currentProject) params.set('project', currentProject);
      const url = `ai.html?${params.toString()}`;

      const webview = new WebviewWindow('wowilon-ai', {
        url,
        title: 'WoWiLon AI',
        width: 800,
        height: 600,
        resizable: true,
        minWidth: 400,
        minHeight: 400,
        center: true
      });

      webview.once('tauri://error', (e) => {
        console.error('Error creating AI window:', e);
      });
    } catch (e) {
      console.error('Failed to create AI window:', e);
    }
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
    } catch (e) {
      console.error("Failed to load modes", e);
      modes.value = [{ slug: 'chat', name: 'Собеседник' }, { slug: 'edit', name: 'Редактор' }, { slug: 'analyze', name: 'Аналитик' }];
    }

    unlistenApproval = await listen<{
      call_id: string;
      chat_id: string;
      assistant_msg_id: string;
      tool_name: string;
      action?: string;
      payload?: unknown;
      description?: string;
    }>('ww-ai-tool-approval-request', (event) => {
      const req = event.payload;
      if (req.chat_id && activeChatId.value && req.chat_id !== activeChatId.value) {
        return;
      }
      const msg = allMessages.value.find(m => m.id === req.assistant_msg_id) 
        || allMessages.value[allMessages.value.length - 1];
      if (msg) {
        msg.toolCallWaiting = {
          tool_call_id: req.call_id,
          tool_name: req.tool_name,
          tool_args: req.payload,
          action: req.action,
          description: req.description
        };
      }
    });

    unlistenChunk = await listen<{
      chat_id: string;
      message_id: string;
      chunk_type?: string;
      text: string;
      is_done?: boolean;
    }>('chat_stream_chunk', (event) => {
      const chunk = event.payload;

      // Ищем сообщение по message_id напрямую — это защищает от race condition,
      // когда activeChatId ещё не обновился к моменту первого чанка.
      const msg = allMessages.value.find(m => m.id === chunk.message_id);

      // Если сообщение не найдено — возможно, чанк для другого окна, игнорируем.
      if (!msg) {
        // Попутно: если chat_id не совпадает совсем — точно чужое окно, тихо выходим.
        if (chunk.chat_id !== activeChatId.value) return;
        // Иначе это наш чат, но placeholder ещё не добавился (крайний race) — 
        // добавляем «на лету» и записываем в него.
        const lastGroup = renderedMessages.value[renderedMessages.value.length - 1];
        const parentId = lastGroup?.activeMessage?.id ?? null;
        const newMsg: ChatMessage = { 
          id: chunk.message_id, 
          role: 'assistant', 
          content: '',
          parent_id: parentId,
          is_active: true
        };
        allMessages.value.push(newMsg);
        if (chunk.chunk_type === 'reasoning') {
          newMsg.reasoning = chunk.text;
        } else if (chunk.chunk_type === 'tool_log') {
          newMsg.toolLogs = [chunk.text];
        } else if (chunk.chunk_type === 'error') {
          newMsg.is_error = true;
          hasError.value = true;
          newMsg.content = chunk.text;
        } else if (chunk.chunk_type === 'usage') {
          try {
            const u = JSON.parse(chunk.text);
            if (u && (u.total_tokens > 0 || u.input_tokens > 0 || u.output_tokens > 0)) {
              tokenUsage.value = u;
              const targetChat = chats.value.find(c => c.id === (chunk.chat_id || activeChatId.value));
              if (targetChat) {
                targetChat.token_usage = u;
              }
            }
          } catch {
            // ignore
          }
        } else {
          newMsg.content = chunk.text;
        }
        if (chunk.is_done) {
          isGenerating.value = false;
          if (newMsg.is_error || newMsg.content.startsWith('🚫') || newMsg.content.startsWith('⚠️') || newMsg.content.startsWith('🔑')) {
            hasError.value = true;
          }
          if (activeChatId.value) {
            void loadMessages(activeChatId.value);
            void loadChats();
          }
        }
        return;
      }

      if (chunk.chunk_type === 'reasoning') {
        msg.reasoning = (msg.reasoning || '') + chunk.text;
      } else if (chunk.chunk_type === 'tool_log') {
        if (!msg.toolLogs) msg.toolLogs = [];
        msg.toolLogs.push(chunk.text);
      } else if (chunk.chunk_type === 'error') {
        msg.is_error = true;
        hasError.value = true;
        msg.content = (msg.content || '') + chunk.text;
      } else if (chunk.chunk_type === 'usage') {
        try {
          const u = JSON.parse(chunk.text);
          if (u && (u.total_tokens > 0 || u.input_tokens > 0 || u.output_tokens > 0)) {
            tokenUsage.value = u;
            const targetChat = chats.value.find(c => c.id === (chunk.chat_id || activeChatId.value));
            if (targetChat) {
              targetChat.token_usage = u;
            }
          }
        } catch {
          // ignore
        }

      } else {
        msg.content = (msg.content || '') + chunk.text;
      }

      if (chunk.is_done) {
        isGenerating.value = false;
        if (msg.is_error || msg.content.startsWith('🚫') || msg.content.startsWith('⚠️') || msg.content.startsWith('🔑')) {
          hasError.value = true;
        }
        if (activeChatId.value) {
          void loadMessages(activeChatId.value);
          void loadChats();
        }
      }
    });
  });

  const retryLastMessage = async () => {
    if (isGenerating.value || isSending.value) return;
    hasError.value = false;
    const lastAssistant = [...allMessages.value].reverse().find(m => m.role === 'assistant');
    if (lastAssistant && lastAssistant.parent_id) {
      await regenerateMessage(lastAssistant.parent_id);
    }
  };

  const unloadModels = async () => {
    try {
      await invoke('cancel_generation', { chatId: activeChatId.value || '' }).catch(() => {});
      await invoke('unload_all_local_models');
      const { appAlert } = await import('@worldwiki/components');
      appAlert('Память GPU успешно очищена.');
    } catch (e) {
      console.error('Ошибка выгрузки моделей:', e);
    }
  };

  onUnmounted(() => {
    if (unlistenChunk) {
      unlistenChunk();
    }
    if (unlistenApproval) {
      unlistenApproval();
    }
  });

  return {
    panelWidth,
    showSidebar,
    isSettingsOpen,
    isToolInspectorOpen,
    selectedContext,
    activeProfile,
    activeModeSlug,
    modes,
    skills,
    loadSkills,
    chatTree,
    activeChatId,
    isChatsLoading,
    currentProject,
    tokenUsage,
    allMessages,
    messages: allMessages,
    renderedMessages,
    isGenerating,
    hasError,
    editingMessageId,
    editDraft,
    messagesListRef,
    chatInputRef,
    handleModeChange,
    toggleSidebar,
    cancelGeneration,
    createNewChat,
    updateChatParent,
    renameChat,
    deleteChats,
    selectChat,
    renderMarkdown,
    getChatTitle,
    saveScroll,
    switchVariant,
    startEdit,
    cancelEdit,
    saveEdit,
    editMessage,
    regenerateMessage,
    retryLastMessage,
    unloadModels,
    handleBranch,
    deleteMessage,
    handleToolApproval,
    handleToolRejection,
    sendMessage,
    loadMessages,
    handleContextSelected,
    handleInsertContext,
    removeContext,
    startResize,
    closePanel,
    detachWindow,
    activeQuote,
    researchProgress,
    handleAskWoWiLon,
    handleClearQuote,
    handleAskSource,
    handleAddToLore
  };
}
