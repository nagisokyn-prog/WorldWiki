import type { ContextItem } from '../../index';
import type { AiMainChatViewProps } from './AiMainChatView.model';

export function useAiMainChatView(props: AiMainChatViewProps) {
  const panel = props.panel;

  const handleMessagesListRef = (el: unknown) => {
    panel.setMessagesListRef(el);
  };

  const handleChatInputRef = (el: unknown) => {
    panel.setChatInputRef(el);
  };

  const onChangeMode = (mode: string) => panel.handleModeChange(mode);
  const onToggleSidebar = () => panel.toggleSidebar();
  const onToggleWebSearch = () => panel.toggleWebSearch();
  const onClearQuote = () => panel.handleClearQuote();
  const onSendMessage = (text: string) => panel.sendMessage(text);
  const onCancelGeneration = () => panel.cancelGeneration();
  const onRetryLastMessage = () => panel.retryLastMessage();
  const onUnloadModels = () => panel.unloadModels();
  const onContextSelected = (ctx: ContextItem[]) => panel.handleContextSelected(ctx);
  const onRemoveContext = (ctx: ContextItem) => panel.removeContext(ctx);

  return {
    handleMessagesListRef,
    handleChatInputRef,
    onChangeMode,
    onToggleSidebar,
    onToggleWebSearch,
    onClearQuote,
    onSendMessage,
    onCancelGeneration,
    onRetryLastMessage,
    onUnloadModels,
    onContextSelected,
    onRemoveContext,
    showSidebar: panel.showSidebar,
    selectedContext: panel.selectedContext,
    activeProfile: panel.activeProfile,
    activeModeSlug: panel.activeModeSlug,
    modes: panel.modes,
    skills: panel.skills,
    chatTree: panel.chatTree,
    activeChatId: panel.activeChatId,
    isChatsLoading: panel.isChatsLoading,
    currentProject: panel.currentProject,
    tokenUsage: panel.tokenUsage,
    messages: panel.messages,
    renderedMessages: panel.renderedMessages,
    isGenerating: panel.isGenerating,
    hasError: panel.hasError,
    editingMessageId: panel.editingMessageId,
    editDraft: panel.editDraft,
    updateEditDraft: panel.updateEditDraft,
    activeQuote: panel.activeQuote,
    isWebSearchEnabled: panel.isWebSearchEnabled,
    researchProgress: panel.researchProgress,
    handleAskSource: panel.handleAskSource,
    createNewChat: panel.createNewChat,
    updateChatParent: panel.updateChatParent,
    renameChat: panel.renameChat,
    deleteChats: panel.deleteChats,
    selectChat: panel.selectChat,
    renderMarkdown: panel.renderMarkdown,
    getChatTitle: panel.getChatTitle,
    saveScroll: panel.saveScroll,
    switchVariant: panel.switchVariant,
    startEdit: panel.startEdit,
    cancelEdit: panel.cancelEdit,
    saveEdit: panel.saveEdit,
    regenerateMessage: panel.regenerateMessage,
    handleBranch: panel.handleBranch,
    deleteMessage: panel.deleteMessage,
    handleToolApproval: panel.handleToolApproval,
    handleToolRejection: panel.handleToolRejection,
    closePanel: panel.closePanel,
    detachWindow: panel.detachWindow
  };
}

