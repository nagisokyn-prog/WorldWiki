import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useAiMessageTree } from '../useAiMessageTree';
import * as api from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getChatMessages: vi.fn(),
  deleteChatMessage: vi.fn(),
  editChatMessage: vi.fn(),
  switchMessageVariant: vi.fn(),
  forkChat: vi.fn(),
}));

describe('useAiMessageTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads messages and formats errors', async () => {
    vi.mocked(api.getChatMessages).mockResolvedValueOnce([
      { id: 'm1', role: 'user', content: 'Hello' },
      { id: 'm2', role: 'assistant', content: '🚫 Rate limit reached' },
    ]);

    const activeChatId = ref('chat_1');
    const tree = useAiMessageTree({
      activeChatId,
      currentProject: 'p1',
      activeModeSlug: ref('chat'),
      showSidebar: ref(false),
      loadChats: vi.fn(),
    });

    await tree.loadMessages('chat_1');
    expect(tree.allMessages.value.length).toBe(2);
    expect(tree.allMessages.value[1].is_error).toBe(true);
    expect(tree.hasError.value).toBe(true);
  });

  it('renders message tree with parent-child variant grouping', () => {
    const activeChatId = ref('chat_1');
    const tree = useAiMessageTree({
      activeChatId,
      currentProject: 'p1',
      activeModeSlug: ref('chat'),
      showSidebar: ref(false),
      loadChats: vi.fn(),
    });

    tree.allMessages.value = [
      { id: 'u1', role: 'user', content: 'Question 1', parent_id: null },
      { id: 'a1_v1', role: 'assistant', content: 'Answer 1 var 1', parent_id: 'u1', is_active: false },
      { id: 'a1_v2', role: 'assistant', content: '<think>Deep reasoning</think>Answer 1 var 2', parent_id: 'u1', is_active: true },
      { id: 'u2', role: 'user', content: 'Followup', parent_id: 'a1_v2' },
    ];

    const rendered = tree.renderedMessages.value;
    expect(rendered.length).toBe(3);

    // Check second group (assistant)
    expect(rendered[1].variants.length).toBe(2);
    expect(rendered[1].activeIndex).toBe(1);
    expect(rendered[1].activeMessage.reasoning).toBe('Deep reasoning');
    expect(rendered[1].activeMessage.content).toBe('Answer 1 var 2');
  });

  it('handles edit drafting and cancellation', async () => {
    const activeChatId = ref('chat_1');
    const tree = useAiMessageTree({
      activeChatId,
      currentProject: 'p1',
      activeModeSlug: ref('chat'),
      showSidebar: ref(false),
      loadChats: vi.fn(),
    });

    tree.allMessages.value = [{ id: 'm1', role: 'user', content: 'Draft content' }];
    tree.startEdit(tree.allMessages.value[0]);
    expect(tree.editingMessageId.value).toBe('m1');
    expect(tree.editDraft.value).toBe('Draft content');

    tree.editDraft.value = 'New content';
    tree.saveEdit('m1');
    expect(api.editChatMessage).toHaveBeenCalledWith('m1', 'New content', 'chat_1', 'p1', 'chat');
    expect(tree.editingMessageId.value).toBeNull();
  });
});
