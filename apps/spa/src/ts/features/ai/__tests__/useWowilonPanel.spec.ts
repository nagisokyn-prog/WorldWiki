import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useWowilonPanel } from '../useWowilonPanel';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

describe('useWowilonPanel', () => {
  let activeChatId: ReturnType<typeof ref<string>>;
  let activeModeSlug: ReturnType<typeof ref<string>>;
  let panel: ReturnType<typeof useWowilonPanel>;

  beforeEach(() => {
    vi.clearAllMocks();
    activeChatId = ref('chat_1');
    activeModeSlug = ref('chat');
    panel = useWowilonPanel(activeChatId, 'proj_1', activeModeSlug);
  });

  describe('loadMessages', () => {
    it('loads messages from invoke and formats active status', async () => {
      const mockRawMessages = [
        { id: 'm1', role: 'user', content: 'Hi', parent_id: null, is_active: true },
        { id: 'm2', role: 'assistant', content: 'Hello!', parent_id: 'm1', is_active: true },
      ];
      vi.mocked(invoke).mockResolvedValue(mockRawMessages as any);

      await panel.loadMessages('chat_1');

      expect(invoke).toHaveBeenCalledWith('get_chat_messages', { chatId: 'chat_1' });
      expect(panel.allMessages.value).toHaveLength(2);
      expect(panel.allMessages.value[0].content).toBe('Hi');
      expect(panel.allMessages.value[1].content).toBe('Hello!');
    });

    it('clears messages when chatId is empty', async () => {
      panel.allMessages.value = [{ role: 'user', content: 'Hello' }];
      await panel.loadMessages('');
      expect(panel.allMessages.value).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('pushes temporary message, invokes send_chat_message and replaces temp IDs', async () => {
      vi.mocked(invoke).mockResolvedValue({
        chat_id: 'chat_1',
        user_msg_id: 'real_user_msg_1',
        assistant_msg_id: 'real_asst_msg_1',
      } as any);

      await panel.sendMessage('Tell me a story');

      expect(invoke).toHaveBeenCalledWith('send_chat_message', {
        chatId: 'chat_1',
        text: 'Tell me a story',
        project: 'proj_1',
        modeSlug: 'chat',
      });

      expect(panel.allMessages.value).toHaveLength(2);
      expect(panel.allMessages.value[0].id).toBe('real_user_msg_1');
      expect(panel.allMessages.value[1].id).toBe('real_asst_msg_1');
      expect(panel.allMessages.value[1].role).toBe('assistant');
    });

    it('does nothing when text is empty', async () => {
      await panel.sendMessage('   ');
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('cancelGeneration', () => {
    it('calls cancel_generation when isGenerating is true', async () => {
      panel.isGenerating.value = true;
      vi.mocked(invoke).mockResolvedValue(undefined as any);

      await panel.cancelGeneration();

      expect(panel.isGenerating.value).toBe(false);
      expect(invoke).toHaveBeenCalledWith('cancel_generation', { chatId: 'chat_1' });
    });
  });

  describe('deleteMessage', () => {
    it('deletes message from backend and removes from state', async () => {
      panel.allMessages.value = [
        { id: 'm1', role: 'user', content: '1' },
        { id: 'm2', role: 'user', content: '2' },
      ];
      vi.mocked(invoke).mockResolvedValue(undefined as any);

      await panel.deleteMessage('m1');

      expect(invoke).toHaveBeenCalledWith('delete_chat_message', { msgId: 'm1' });
      expect(panel.allMessages.value).toHaveLength(1);
      expect(panel.allMessages.value[0].id).toBe('m2');
    });

    it('ignores temporary messages', async () => {
      await panel.deleteMessage('temp_123');
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('regenerateMessage', () => {
    it('marks old assistant messages as inactive and pre-creates new assistant message', async () => {
      panel.allMessages.value = [
        { id: 'user_1', role: 'user', content: 'Prompt', parent_id: null, is_active: true },
        { id: 'asst_1', role: 'assistant', content: 'Answer 1', parent_id: 'user_1', is_active: true },
      ];

      vi.mocked(invoke).mockResolvedValue({
        chat_id: 'chat_1',
        assistant_msg_id: 'asst_2',
      } as any);

      await panel.regenerateMessage('user_1');

      expect(invoke).toHaveBeenCalledWith('regenerate_chat_message', {
        parentMsgId: 'user_1',
        chatId: 'chat_1',
        project: 'proj_1',
        modeSlug: 'chat',
      });

      expect(panel.allMessages.value[1].is_active).toBe(false);
      expect(panel.allMessages.value[2].id).toBe('asst_2');
      expect(panel.allMessages.value[2].is_active).toBe(true);
    });
  });
});
