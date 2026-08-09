import { ref } from 'vue';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCallWaiting?: any;
}

export function useWowilonPanel() {
  const messages = ref<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Привет! Я WoWiLon, ваш ИИ-помощник. Чем могу помочь с вашим миром сегодня?'
    }
  ]);
  const isGenerating = ref(false);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    messages.value.push({ role: 'user', content: text });
    isGenerating.value = true;

    // Simulate AI response (will be replaced with actual backend call)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    messages.value.push({ 
      role: 'assistant', 
      content: `Это заглушка ответа на ваш запрос: "${text}". В будущем здесь будет интеграция с бэкендом (llama-turboquant-cpp).` 
    });
    
    isGenerating.value = false;
  };

  return {
    messages,
    isGenerating,
    sendMessage
  };
}
