import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiChats } from '../useAiChats';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
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
  });
});
