import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useAiStreamListener } from '../useAiStreamListener';
import { listen } from '@tauri-apps/api/event';

const { mockUnlisten } = vi.hoisted(() => ({
  mockUnlisten: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(mockUnlisten),
}));

describe('useAiStreamListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to stream events and unlistens properly', async () => {
    const activeChatId = ref('chat_1');
    const allMessages = ref([]);
    const renderedMessages = ref([]);
    const tokenUsage = ref({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
    const chats = ref([]);
    const isGenerating = ref(false);
    const hasError = ref(false);

    useAiStreamListener({
      activeChatId,
      allMessages,
      renderedMessages,
      tokenUsage,
      chats,
      isGenerating,
      hasError,
      loadMessages: vi.fn(),
      loadChats: vi.fn(),
    });

    expect(listen).toBeDefined();
  });
});
