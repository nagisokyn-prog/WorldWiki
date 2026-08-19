import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiChats } from '../useAiChats';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockAppAlert = vi.fn();
vi.mock('@worldwiki/components', () => ({
  appAlert: (...args: any[]) => mockAppAlert(...args),
}));

describe('useAiChats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadChats & chatTree hierarchy computation', () => {
    it('loads flat chat list and builds hierarchical tree sorted by date', async () => {
      const rawChats = [
        { id: 'c1', title: 'Root Chat 1', parent_chat_id: null, created_at: '2024-01-01T10:00:00Z' },
        { id: 'c2', title: 'Child of 1', parent_chat_id: 'c1', created_at: '2024-01-01T11:00:00Z' },
        { id: 'c3', title: 'Root Chat 2', parent_chat_id: null, created_at: '2024-01-02T10:00:00Z' },
      ];
      vi.mocked(invoke).mockResolvedValue(rawChats);

      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();

      expect(invoke).toHaveBeenCalledWith('get_chat_tree', { projectId: 'project_1' });
      expect(aiChats.chats.value).toHaveLength(3);

      const tree = aiChats.chatTree.value;
      // c3 is newer, so it should be first root
      expect(tree).toHaveLength(2);
      expect(tree[0].id).toBe('c3');
      expect(tree[1].id).toBe('c1');
      expect(tree[1].children).toHaveLength(1);
      expect(tree[1].children![0].id).toBe('c2');
    });

    it('handles loadChats error gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Load error'));
      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();
      expect(aiChats.isLoading.value).toBe(false);
    });
  });

  describe('createNewChat', () => {
    it('resets activeChatId to empty string', async () => {
      const aiChats = useAiChats('project_1');
      aiChats.activeChatId.value = 'old_chat';
      await aiChats.createNewChat();
      expect(aiChats.activeChatId.value).toBe('');
    });
  });

  describe('renameChat', () => {
    it('saves updated chat title', async () => {
      const rawChats = [
        { id: 'c1', title: 'Old Title', parent_chat_id: null },
      ];
      vi.mocked(invoke).mockResolvedValue(rawChats);

      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();

      await aiChats.renameChat('c1', 'New Title');

      expect(invoke).toHaveBeenCalledWith('save_chat', {
        data: expect.objectContaining({
          id: 'c1',
          title: 'New Title',
          project_id: 'project_1',
        })
      });
    });

    it('does nothing if chat is not found', async () => {
      const aiChats = useAiChats('project_1');
      await aiChats.renameChat('non_existent', 'Title');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('handles rename error gracefully', async () => {
      const rawChats = [{ id: 'c1', title: 'Old Title' }];
      vi.mocked(invoke).mockResolvedValueOnce(rawChats).mockRejectedValueOnce(new Error('Save error'));

      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();
      await aiChats.renameChat('c1', 'New Title');
    });
  });

  describe('deleteChats', () => {
    it('invokes delete for each chat ID and resets activeChatId if deleted', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const aiChats = useAiChats('project_1');
      aiChats.activeChatId.value = 'c1';

      await aiChats.deleteChats(['c1', 'c2']);

      expect(invoke).toHaveBeenCalledWith('delete_ai_chat', { project: 'project_1', id: 'c1' });
      expect(invoke).toHaveBeenCalledWith('delete_ai_chat', { project: 'project_1', id: 'c2' });
      expect(aiChats.activeChatId.value).toBe('');
    });

    it('handles delete error gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Delete error'));
      const aiChats = useAiChats('project_1');
      await aiChats.deleteChats(['c1']);
    });
  });

  describe('branchChat', () => {
    it('forks chat, reloads list and sets activeChatId to new chat', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'fork_chat') return { id: 'forked_chat_1' };
        if (cmd === 'get_chat_tree') return [{ id: 'forked_chat_1', title: 'Branch 1' }];
        return null;
      });

      const aiChats = useAiChats('project_1');
      await aiChats.branchChat('msg_123', 'My Branch');

      expect(invoke).toHaveBeenCalledWith('fork_chat', {
        projectId: 'project_1',
        messageId: 'msg_123',
        newTitle: 'My Branch',
      });
      expect(aiChats.activeChatId.value).toBe('forked_chat_1');
    });

    it('alerts user on branch error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Fork failed'));
      const aiChats = useAiChats('project_1');
      await aiChats.branchChat('msg_123');
      expect(mockAppAlert).toHaveBeenCalled();
    });
  });

  describe('updateChatParent', () => {
    it('optimistically updates chat parent and invokes backend', async () => {
      const rawChats = [{ id: 'c1', title: 'Chat 1', parent_chat_id: null }];
      vi.mocked(invoke).mockResolvedValue(rawChats);

      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();

      await aiChats.updateChatParent('c1', 'new_parent_id');

      expect(aiChats.chats.value[0].parent_chat_id).toBe('new_parent_id');
      expect(invoke).toHaveBeenCalledWith('update_chat_parent', {
        chatId: 'c1',
        newParentId: 'new_parent_id',
      });
    });

    it('handles falsy newParentId (sets to undefined) and chat not found', async () => {
      const rawChats = [{ id: 'c1', title: 'Chat 1', parent_chat_id: 'p1' }];
      vi.mocked(invoke).mockResolvedValue(rawChats);

      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();

      // Setting null parentId
      await aiChats.updateChatParent('c1', null);
      expect(aiChats.chats.value[0].parent_chat_id).toBeUndefined();

      // Chat not found
      await aiChats.updateChatParent('unknown_chat', 'p2');
    });

    it('reverts on failure by reloading chats', async () => {
      const rawChats = [{ id: 'c1', title: 'Chat 1', parent_chat_id: null }];
      vi.mocked(invoke)
        .mockResolvedValueOnce(rawChats) // loadChats initial
        .mockRejectedValueOnce(new Error('Update failed')) // updateChatParent invoke
        .mockResolvedValueOnce(rawChats); // loadChats revert

      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();

      await aiChats.updateChatParent('c1', 'parent_2');
      expect(invoke).toHaveBeenCalledWith('get_chat_tree', { projectId: 'project_1' });
    });
  });

  describe('chatTree and renameChat branch edge cases', () => {
    it('handles chats without created_at in sort and tag/parent_chat_id in renameChat', async () => {
      const rawChats = [
        { id: 'c1', title: 'Chat 1', tag: 'tag1', parent_chat_id: 'p1' },
        { id: 'c2', title: 'Chat 2' }, // no tag, no parent_chat_id, no created_at
      ];
      vi.mocked(invoke).mockResolvedValue(rawChats);

      const aiChats = useAiChats('project_1');
      await aiChats.loadChats();

      // Check chatTree with missing created_at
      const tree = aiChats.chatTree.value;
      expect(tree).toHaveLength(2);

      // Rename chat with tag and parent_chat_id
      await aiChats.renameChat('c1', 'New C1');
      expect(invoke).toHaveBeenCalledWith('save_chat', {
        data: expect.objectContaining({
          tag: 'tag1',
          parent_chat_id: 'p1',
        }),
      });

      // Rename chat without tag and parent_chat_id
      await aiChats.renameChat('c2', 'New C2');
      expect(invoke).toHaveBeenCalledWith('save_chat', {
        data: expect.objectContaining({
          tag: undefined,
          parent_chat_id: undefined,
        }),
      });
    });
  });
});
