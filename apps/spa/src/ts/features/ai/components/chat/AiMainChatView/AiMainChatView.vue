<template>
  <div class="wowilon-inner">
    <AiHeader 
      :active-profile="activeProfile"
      @close="closePanel" 
      @detach="detachWindow" 
      @open-settings="emit('open-settings')" 
    />

    <div class="wowilon-body">
      <AiChatHistory 
        v-if="showSidebar" 
        :chat-tree="chatTree"
        :active-chat-id="activeChatId"
        :is-loading="isChatsLoading"
        @select-chat="selectChat"
        @new-chat="createNewChat"
        @move-chat="updateChatParent"
        @rename-chat="renameChat"
        @delete-chats="deleteChats"
        @toggle="onToggleSidebar"
      />

      <div class="wowilon-chat-area">
        <AiChatTopBar 
          :active-profile="activeProfile" 
          :token-usage="tokenUsage"
          :modes="modes"
          :active-mode-slug="activeModeSlug"
          :current-project="currentProject"
          @change-mode="onChangeMode"
          @toggle-sidebar="onToggleSidebar"
          @restart-session="onCancelGeneration"
        />
        
        <AiMessageList 
          :ref="handleMessagesListRef"
          :messages="messages"
          :rendered-messages="renderedMessages"
          :active-chat-id="activeChatId"
          :chat-title="getChatTitle(activeChatId)"
          :editing-message-id="editingMessageId"
          :edit-draft="editDraft"
          :render-markdown="renderMarkdown"
          :is-generating="isGenerating"
          @update:edit-draft="updateEditDraft"
          @scroll="saveScroll"
          @switch-variant="switchVariant"
          @start-edit="startEdit"
          @cancel-edit="cancelEdit"
          @save-edit="saveEdit"
          @regenerate="regenerateMessage"
          @branch="handleBranch"
          @delete="deleteMessage"
          @tool-approve="handleToolApproval"
          @tool-reject="handleToolRejection"
          @ask-source="handleAskSource"
        />

        <!-- Индикатор хода глубокого исследования -->
        <AiResearchProgress
          :stage="researchProgress.stage"
          :query="researchProgress.query"
          :hits-count="researchProgress.hitsCount"
          :pages-count="researchProgress.pagesCount"
          :evidence-count="researchProgress.evidenceCount"
        />

        <AiChatInputArea
          :ref="handleChatInputRef"
          :is-generating="isGenerating"
          :has-error="hasError"
          :selected-context="selectedContext"
          :current-project="currentProject"
          :active-mode-slug="activeModeSlug"
          :modes="modes"
          :is-web-search-enabled="isWebSearchEnabled"
          :active-quote="activeQuote"
          :skills="skills"
          @cancel="onCancelGeneration"
          @retry="onRetryLastMessage"
          @unload-models="onUnloadModels"
          @context-selected="onContextSelected"
          @remove-context="onRemoveContext"
          @change-mode="onChangeMode"
          @toggle-web-search="onToggleWebSearch"
          @clear-quote="onClearQuote"
          @submit="onSendMessage"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AiHeader,
  AiChatHistory,
  AiChatTopBar,
  AiMessageList,
  AiChatInputArea,
  AiResearchProgress,
  type ContextItem
} from '../../index';
import type { AiMainChatViewProps, AiMainChatViewEmits } from './AiMainChatView.model';

const props = defineProps<AiMainChatViewProps>();
const emit = defineEmits<AiMainChatViewEmits>();

const handleMessagesListRef = (el: unknown) => {
  props.panel.setMessagesListRef(el);
};

const handleChatInputRef = (el: unknown) => {
  props.panel.setChatInputRef(el);
};

const onChangeMode = (mode: string) => props.panel.handleModeChange(mode);
const onToggleSidebar = () => props.panel.toggleSidebar();
const onToggleWebSearch = () => props.panel.toggleWebSearch();
const onClearQuote = () => props.panel.handleClearQuote();
const onSendMessage = (text: string) => props.panel.sendMessage(text);
const onCancelGeneration = () => props.panel.cancelGeneration();
const onRetryLastMessage = () => props.panel.retryLastMessage();
const onUnloadModels = () => props.panel.unloadModels();
const onContextSelected = (ctx: ContextItem[]) => props.panel.handleContextSelected(ctx);
const onRemoveContext = (ctx: ContextItem) => props.panel.removeContext(ctx);

const {
  showSidebar,
  selectedContext,
  activeProfile,
  activeModeSlug,
  modes,
  skills,
  chatTree,
  activeChatId,
  isChatsLoading,
  currentProject,
  tokenUsage,
  messages,
  renderedMessages,
  isGenerating,
  hasError,
  editingMessageId,
  editDraft,
  updateEditDraft,
  activeQuote,
  isWebSearchEnabled,
  researchProgress,
  handleAskSource,
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
  regenerateMessage,
  handleBranch,
  deleteMessage,
  handleToolApproval,
  handleToolRejection,
  closePanel,
  detachWindow
} = props.panel;
</script>
