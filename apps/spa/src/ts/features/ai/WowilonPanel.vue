<template>
  <div class="wowilon-panel" :class="{ 'is-open': isOpen }" :style="{ '--panel-w': panelWidth + 'px' }">
    <div class="wowilon-resize-handle" @mousedown.prevent="startResize"></div>
    
    <!-- SETTINGS VIEW -->
    <AiSettingsView 
      v-if="isSettingsOpen" 
      @close="isSettingsOpen = false" 
    />
    
    <!-- MAIN CHAT VIEW -->
    <div v-else class="wowilon-inner">
      <AiHeader 
        :active-profile="activeProfile"
        @close="closePanel" 
        @detach="detachWindow" 
        @open-settings="isSettingsOpen = true" 
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

    <!-- Всплывающий тулбар при выделении текста в сообщениях -->
    <AiSelectionToolbar
      @ask-wowilon="handleAskWoWiLon"
      @add-to-lore="handleAddToLore"
    />

    <!-- MANUAL TOOL INSPECTOR -->
    <AiToolInspector
      :is-open="isToolInspectorOpen"
      :current-project="currentProject"
      @close="isToolInspectorOpen = false"
      @insert-context="handleInsertContext"
    />
  </div>
</template>

<script setup lang="ts">
import {
  AiHeader,
  AiChatHistory,
  AiChatTopBar,
  AiMessageList,
  AiChatInputArea,
  AiToolInspector,
  AiSelectionToolbar,
  AiResearchProgress
} from './components';
import AiSettingsView from './settings/AiSettingsView.vue';
import { useWowilonPanel, type WowilonPanelProps, type WowilonPanelEmits } from './useWowilonPanel';

const props = defineProps<WowilonPanelProps>();
const emit = defineEmits<WowilonPanelEmits>();

const {
  panelWidth,
  showSidebar,
  isSettingsOpen,
  isToolInspectorOpen,
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
  handleAskWoWiLon,
  handleClearQuote,
  handleAskSource,
  handleAddToLore,
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
  handleInsertContext,
  removeContext,
  startResize,
  closePanel,
  detachWindow
} = useWowilonPanel(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/WowilonPanel.css"></style>
