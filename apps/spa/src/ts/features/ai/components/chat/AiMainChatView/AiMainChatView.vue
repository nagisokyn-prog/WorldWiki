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
        @toggle="toggleSidebar"
      />

      <div class="wowilon-chat-area">
        <AiChatTopBar 
          :active-profile="activeProfile" 
          :token-usage="tokenUsage"
          :modes="modes"
          :active-mode-slug="activeModeSlug"
          :current-project="currentProject"
          @change-mode="handleModeChange"
          @toggle-sidebar="toggleSidebar"
          @restart-session="cancelGeneration"
        />
        
        <AiMessageList 
          ref="messagesListRef"
          v-model:edit-draft="editDraft"
          :messages="messages"
          :rendered-messages="renderedMessages"
          :active-chat-id="activeChatId"
          :chat-title="getChatTitle(activeChatId)"
          :editing-message-id="editingMessageId"
          :render-markdown="renderMarkdown"
          :is-generating="isGenerating"
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
          ref="chatInputRef"
          :is-generating="isGenerating"
          :has-error="hasError"
          :selected-context="selectedContext"
          :current-project="currentProject"
          :active-mode-slug="activeModeSlug"
          :modes="modes"
          :is-web-search-enabled="isWebSearchEnabled"
          :active-quote="activeQuote"
          :skills="skills"
          @cancel="cancelGeneration"
          @retry="retryLastMessage"
          @unload-models="unloadModels"
          @context-selected="handleContextSelected"
          @remove-context="removeContext"
          @change-mode="handleModeChange"
          @toggle-web-search="toggleWebSearch"
          @clear-quote="handleClearQuote"
          @submit="sendMessage"
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
  AiResearchProgress
} from '../../index';
import type { AiMainChatViewProps, AiMainChatViewEmits } from './AiMainChatView.model';

const props = defineProps<AiMainChatViewProps>();
const emit = defineEmits<AiMainChatViewEmits>();

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
  messagesListRef,
  chatInputRef,
  activeQuote,
  isWebSearchEnabled,
  toggleWebSearch,
  researchProgress,
  handleClearQuote,
  handleAskSource,
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
  regenerateMessage,
  retryLastMessage,
  unloadModels,
  handleBranch,
  deleteMessage,
  handleToolApproval,
  handleToolRejection,
  sendMessage,
  handleContextSelected,
  removeContext,
  closePanel,
  detachWindow
} = props.panel;
</script>
