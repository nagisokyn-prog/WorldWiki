import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import AiMainChatView from '../AiMainChatView.vue';

vi.mock('../../../index', () => ({
  AiHeader: { name: 'AiHeader', template: '<div class="mock-ai-header" />' },
  AiChatHistory: { name: 'AiChatHistory', template: '<div class="mock-ai-history" />' },
  AiChatTopBar: { name: 'AiChatTopBar', template: '<div class="mock-ai-topbar" />' },
  AiMessageList: { name: 'AiMessageList', template: '<div class="mock-ai-messages" />' },
  AiChatInputArea: { name: 'AiChatInputArea', template: '<div class="mock-ai-input" />' },
  AiResearchProgress: { name: 'AiResearchProgress', template: '<div class="mock-ai-research" />' }
}));

vi.mock('../../index', () => ({
  AiHeader: { name: 'AiHeader', template: '<div class="mock-ai-header" />' },
  AiChatHistory: { name: 'AiChatHistory', template: '<div class="mock-ai-history" />' },
  AiChatTopBar: { name: 'AiChatTopBar', template: '<div class="mock-ai-topbar" />' },
  AiMessageList: { name: 'AiMessageList', template: '<div class="mock-ai-messages" />' },
  AiChatInputArea: { name: 'AiChatInputArea', template: '<div class="mock-ai-input" />' },
  AiResearchProgress: { name: 'AiResearchProgress', template: '<div class="mock-ai-research" />' }
}));

describe('AiMainChatView.vue', () => {
  const createMockPanel = () => ({
    showSidebar: ref(true),
    selectedContext: ref([]),
    activeProfile: ref({ id: 'p1', name: 'Profile 1' }),
    activeModeSlug: ref('chat'),
    modes: ref([]),
    skills: ref([]),
    chatTree: ref([]),
    activeChatId: ref('chat-1'),
    isChatsLoading: ref(false),
    currentProject: 'project-1',
    tokenUsage: ref({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    messages: ref([]),
    renderedMessages: ref([]),
    isGenerating: ref(false),
    hasError: ref(false),
    editingMessageId: ref(null),
    editDraft: ref(''),
    updateEditDraft: vi.fn(),
    messagesListRef: ref(null),
    chatInputRef: ref(null),
    setMessagesListRef: vi.fn(),
    setChatInputRef: vi.fn(),
    activeQuote: ref(null),
    isWebSearchEnabled: ref(false),
    toggleWebSearch: vi.fn(),
    researchProgress: ref({ stage: '', query: '', hitsCount: 0, pagesCount: 0, evidenceCount: 0 }),
    handleClearQuote: vi.fn(),
    handleAskSource: vi.fn(),
    handleModeChange: vi.fn(),
    toggleSidebar: vi.fn(),
    cancelGeneration: vi.fn(),
    createNewChat: vi.fn(),
    updateChatParent: vi.fn(),
    renameChat: vi.fn(),
    deleteChats: vi.fn(),
    selectChat: vi.fn(),
    renderMarkdown: vi.fn((t: string) => t),
    getChatTitle: vi.fn(() => 'Test Chat'),
    saveScroll: vi.fn(),
    switchVariant: vi.fn(),
    startEdit: vi.fn(),
    cancelEdit: vi.fn(),
    saveEdit: vi.fn(),
    regenerateMessage: vi.fn(),
    retryLastMessage: vi.fn(),
    unloadModels: vi.fn(),
    handleBranch: vi.fn(),
    deleteMessage: vi.fn(),
    handleToolApproval: vi.fn(),
    handleToolRejection: vi.fn(),
    sendMessage: vi.fn(),
    handleContextSelected: vi.fn(),
    removeContext: vi.fn(),
    closePanel: vi.fn(),
    detachWindow: vi.fn(),
    panelWidth: ref(400),
    startResize: vi.fn(),
    isSettingsOpen: ref(false),
    isToolInspectorOpen: ref(false),
    handleAskWoWiLon: vi.fn(),
    handleAddToLore: vi.fn(),
    handleInsertContext: vi.fn()
  });

  it('renders main chat layout properly with mock panel', () => {
    const mockPanel = createMockPanel();
    const wrapper = mount(AiMainChatView, {
      props: {
        panel: mockPanel as any
      },
      global: {
        stubs: {
          AiHeader: { template: '<div class="mock-ai-header" />' },
          AiChatHistory: { template: '<div class="mock-ai-history" />' },
          AiChatTopBar: { template: '<div class="mock-ai-topbar" />' },
          AiMessageList: { template: '<div class="mock-ai-messages" />' },
          AiChatInputArea: { template: '<div class="mock-ai-input" />' },
          AiResearchProgress: { template: '<div class="mock-ai-research" />' }
        }
      }
    });

    expect(wrapper.find('.wowilon-inner').exists()).toBe(true);
    expect(wrapper.find('.mock-ai-header').exists()).toBe(true);
    expect(wrapper.find('.mock-ai-history').exists()).toBe(true);
    expect(wrapper.find('.mock-ai-topbar').exists()).toBe(true);
    expect(wrapper.find('.mock-ai-messages').exists()).toBe(true);
    expect(wrapper.find('.mock-ai-input').exists()).toBe(true);
  });
});
