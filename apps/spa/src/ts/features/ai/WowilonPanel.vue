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

          <div class="chat-input-container">
            <AiActionButtons 
              :is-generating="isGenerating"
              :has-error="hasError"
              :can-resume="false"
              @cancel="cancelGeneration"
              @retry="retryLastMessage"
              @unload-models="unloadModels"
              @resume="() => {}"
            />
            
            <div class="input-controls-row">
              <AiContextSelector
                :selected-context="selectedContext"
                :current-project="currentProject"
                @context-selected="handleContextSelected"
                @remove-context="removeContext"
              />
              <AiModeSelector
                placement="top"
                :active-mode-slug="activeModeSlug"
                :modes="modes"
                @change-mode="handleModeChange"
              />
              <AiAutoApproveModal
                placement="top"
                :current-project="currentProject"
                :active-mode-slug="activeModeSlug"
              />
              <!-- 4. 🌐 Переключатель Web Search (DeepSeek Style) -->
              <button
                type="button"
                class="ds-toggle-button interactive-el"
                :class="{ 'is-active': isWebSearchEnabled }"
                :title="isWebSearchEnabled ? 'Поиск в интернете включен' : 'Включить веб-поиск'"
                @click="toggleWebSearch"
              >
                <div class="ds-toggle-button__icon">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
                    <circle cx="8" cy="8" r="6.85" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M8 1.15C9.6 1.15 10.9 4.22 10.9 8C10.9 11.78 9.6 14.85 8 14.85" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M8 1.15C6.4 1.15 5.1 4.22 5.1 8C5.1 11.78 6.4 14.85 8 14.85" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M1.64 8H14.36" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                </div>
                <span class="ds-toggle-label">Search</span>
              </button>
            </div>

            <!-- Баннер цитируемого фрагмента сообщения -->
            <AiQuoteReplyBanner
              :quoted-text="activeQuote?.selected_text"
              @clear="handleClearQuote"
            />

            <AiChatInput 
              ref="chatInputRef"
              :loading="isGenerating"
              :skills="skills"
              @submit="sendMessage"
            />
          </div>
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
import AiHeader from './components/AiHeader.vue';
import AiChatHistory from './components/AiChatHistory.vue';
import AiChatTopBar from './components/AiChatTopBar.vue';
import AiMessageList from './components/AiMessageList.vue';
import AiChatInput from './components/AiChatInput.vue';
import AiActionButtons from './components/AiActionButtons.vue';
import AiContextSelector from './components/AiContextSelector.vue';
import AiModeSelector from './components/AiModeSelector.vue';
import AiAutoApproveModal from './components/AiAutoApproveModal.vue';
import AiToolInspector from './components/AiToolInspector.vue';
import AiSelectionToolbar from './components/AiSelectionToolbar.vue';
import AiQuoteReplyBanner from './components/AiQuoteReplyBanner.vue';
import AiResearchProgress from './components/AiResearchProgress.vue';
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
