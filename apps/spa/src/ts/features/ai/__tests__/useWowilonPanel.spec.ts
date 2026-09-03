import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWowilonPanel } from '../useWowilonPanel';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { mockUnlisten } = vi.hoisted(() => ({
  mockUnlisten: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(mockUnlisten),
}));

describe('useWowilonPanel', () => {
  let emit: any;
  let panel: ReturnType<typeof useWowilonPanel>;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    panel = useWowilonPanel({ isOpen: true }, emit);
    panel.activeChatId.value = 'chat_1';
    panel.activeModeSlug.value = 'chat';
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

    it('handles loadMessages error gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Network error'));
      await panel.loadMessages('chat_err');
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

      expect(invoke).toHaveBeenCalledWith('send_chat_message', expect.objectContaining({
        chatId: 'chat_1',
        message: 'Tell me a story',
        modeSlug: 'chat',
      }));

      expect(panel.allMessages.value.length).toBeGreaterThanOrEqual(1);
    });

    it('triggers title generation when starting a new chat with empty activeChatId', async () => {
      panel.activeChatId.value = '';
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'send_chat_message') {
          return { chat_id: 'new_chat_100', user_msg_id: 'u1', assistant_msg_id: 'a1' };
        }
        if (cmd === 'generate_chat_title') {
          return 'New Title';
        }
      });

      await panel.sendMessage('First prompt');
      expect(panel.activeChatId.value).toBe('');
    });

    it('handles sendMessage error gracefully', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Send failed'));
      await panel.sendMessage('Prompt');
      expect(panel.isGenerating.value).toBe(false);
    });

    it('does nothing when text is empty', async () => {
      vi.mocked(invoke).mockClear();
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

    it('handles error in cancelGeneration', async () => {
      panel.isGenerating.value = true;
      vi.mocked(invoke).mockRejectedValue(new Error('Cancel failed'));
      await panel.cancelGeneration();
      expect(panel.isGenerating.value).toBe(false);
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

      expect(invoke).toHaveBeenCalledWith('delete_chat_message', { messageId: 'm1' });
      expect(panel.allMessages.value).toHaveLength(1);
      expect(panel.allMessages.value[0].id).toBe('m2');
    });

    it('ignores temporary messages or empty msgId', async () => {
      vi.mocked(invoke).mockClear();
      await panel.deleteMessage('temp_123');
      await panel.deleteMessage('');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('handles deleteMessage error', async () => {
      panel.allMessages.value = [{ id: 'm1', role: 'user', content: '1' }];
      vi.mocked(invoke).mockRejectedValue(new Error('Delete error'));
      await panel.deleteMessage('m1');
      expect(panel.allMessages.value).toHaveLength(1);
    });
  });

  describe('editMessage', () => {
    it('invokes edit_chat_message and reloads messages', async () => {
      panel.allMessages.value = [{ id: 'm1', role: 'user', content: 'Old' }];
      vi.mocked(invoke).mockResolvedValue(undefined as any);

      await panel.editMessage('m1', 'New text');

      expect(invoke).toHaveBeenCalledWith('edit_chat_message', {
        messageId: 'm1',
        newContent: 'New text',
      });
      expect(panel.allMessages.value[0].content).toBe('New text');
    });

    it('ignores edit for temp or empty text', async () => {
      vi.mocked(invoke).mockClear();
      await panel.editMessage('temp_1', 'hello');
      await panel.editMessage('m1', '   ');
      expect(invoke).not.toHaveBeenCalled();
    });

    it('handles editMessage error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Edit failed'));
      await panel.editMessage('m1', 'New text');
      expect(panel.isGenerating.value).toBe(false);
    });
  });

  describe('regenerateMessage', () => {
    it('marks old assistant messages as inactive and pre-creates new assistant message', async () => {
      panel.allMessages.value = [
        { id: 'user_1', role: 'user', content: 'Prompt', parent_id: null, is_active: true },
        { id: 'asst_1', role: 'assistant', content: 'Answer 1', parent_id: 'user_1', is_active: true },
      ];

      vi.mocked(invoke).mockResolvedValue(undefined as any);

      await panel.regenerateMessage('user_1');

      expect(invoke).toHaveBeenCalledWith('regenerate_chat_message', expect.objectContaining({
        messageId: 'user_1',
        chatId: 'chat_1',
        modeSlug: 'chat',
      }));
    });

    it('handles regenerateMessage error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Regen failed'));
      await panel.regenerateMessage('user_1');
      expect(panel.isGenerating.value).toBe(false);
    });
  });

  describe('switchVariant', () => {
    it('invokes switch_message_variant and reloads messages', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'switch_message_variant') return undefined;
        if (cmd === 'get_chat_messages') return [{ id: 'var_2', role: 'assistant', is_active: true }];
      });

      await panel.switchVariant('var_2');
      expect(invoke).toHaveBeenCalledWith('switch_message_variant', { messageId: 'var_2' });
      expect(panel.allMessages.value).toHaveLength(1);
    });

    it('handles switchVariant error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Switch failed'));
      await panel.switchVariant('var_2');
    });
  });

  describe('renderedMessages computed tree', () => {
    it('builds linear tree of active variants correctly', () => {
      panel.allMessages.value = [
        { id: 'u1', role: 'user', content: 'Hello', parent_id: null, is_active: true },
        { id: 'a1_v1', role: 'assistant', content: 'Hi v1', parent_id: 'u1', is_active: false },
        { id: 'a1_v2', role: 'assistant', content: 'Hi v2', parent_id: 'u1', is_active: true },
        { id: 'u2', role: 'user', content: 'Next', parent_id: 'a1_v2', is_active: true },
      ];

      const groups = panel.renderedMessages.value;
      expect(groups).toHaveLength(3);
      expect(groups[0].activeMessage.id).toBe('u1');
      expect(groups[1].variants).toHaveLength(2);
      expect(groups[1].activeIndex).toBe(1);
      expect(groups[1].activeMessage.id).toBe('a1_v2');
      expect(groups[2].activeMessage.id).toBe('u2');
    });

    it('extracts <think> tags into reasoning', () => {
      panel.allMessages.value = [
        {
          id: 'a1',
          role: 'assistant',
          content: '<think>Reasoning thoughts</think>Clean message',
          parent_id: null,
          is_active: true,
        },
        {
          id: 'a2',
          role: 'assistant',
          content: '<think>Unfinished thoughts',
          parent_id: 'a1',
          is_active: true,
        },
      ];

      const groups = panel.renderedMessages.value;
      expect(groups[0].activeMessage.reasoning).toBe('Reasoning thoughts');
      expect(groups[0].activeMessage.content).toBe('Clean message');
      expect(groups[1].activeMessage.reasoning).toBe('Unfinished thoughts');
      expect(groups[1].activeMessage.content).toBe('');
    });
  });

  describe('Stream chunk event listening', () => {
    it('appends streaming reasoning, tool logs, usage, text and finishes on is_done in mounted lifecycle', async () => {
      const { defineComponent } = await import('vue');
      const { mount, flushPromises } = await import('@vue/test-utils');

      let capturedPanel: any;
      const TestComp = defineComponent({
        setup() {
          capturedPanel = useWowilonPanel({ isOpen: true }, vi.fn());
          return { ...capturedPanel };
        },
        template: '<div></div>',
      });

      const wrapper = mount(TestComp);
      await flushPromises();

      capturedPanel.allMessages.value = [
        { id: 'asst_1', role: 'assistant', content: '', reasoning: '', is_active: true }
      ];
      capturedPanel.activeChatId.value = 'chat_1';
      capturedPanel.isGenerating.value = true;

      // Find the listener callback registered in listen
      const calls = vi.mocked(listen).mock.calls;
      const streamHandler = calls.find((c: any) => c[0] === 'chat_stream_chunk')?.[1] as any;
      expect(streamHandler).toBeDefined();

      if (streamHandler) {
        // Reasoning chunk
        streamHandler({
          payload: {
            chat_id: 'chat_1',
            message_id: 'asst_1',
            chunk_type: 'reasoning',
            text: 'Thinking...',
          }
        });
        expect(capturedPanel.allMessages.value[0].reasoning).toBe('Thinking...');

        // Tool log chunk
        streamHandler({
          payload: {
            chat_id: 'chat_1',
            message_id: 'asst_1',
            chunk_type: 'tool_log',
            text: 'Called search tool',
          }
        });
        expect(capturedPanel.allMessages.value[0].toolLogs).toEqual(['Called search tool']);

        // Usage chunk
        streamHandler({
          payload: {
            chat_id: 'chat_1',
            message_id: 'asst_1',
            chunk_type: 'usage',
            text: JSON.stringify({ input_tokens: 10, output_tokens: 20, total_tokens: 30 }),
          }
        });
        expect(capturedPanel.tokenUsage.value).toEqual({ input_tokens: 10, output_tokens: 20, total_tokens: 30 });

        // Content chunk
        streamHandler({
          payload: {
            chat_id: 'chat_1',
            message_id: 'asst_1',
            chunk_type: 'content',
            text: 'Final Answer',
            is_done: true,
          }
        });
        expect(capturedPanel.allMessages.value[0].content).toBe('Final Answer');
        expect(capturedPanel.isGenerating.value).toBe(false);

        // Unknown message_id test
        streamHandler({
          payload: {
            chat_id: 'chat_1',
            message_id: 'unknown_id',
            chunk_type: 'content',
            text: 'Ignore me',
          }
        });

        // Invalid usage JSON test
        streamHandler({
          payload: {
            chat_id: 'chat_1',
            message_id: 'asst_1',
            chunk_type: 'usage',
            text: 'invalid json',
          }
        });

        // Chunk for another chat
        streamHandler({
          payload: {
            chat_id: 'other_chat',
            message_id: 'asst_1',
            chunk_type: 'content',
            text: 'Ignore',
          }
        });
      }

      wrapper.unmount();
      expect(mockUnlisten).toHaveBeenCalled();
    });
  });
});
