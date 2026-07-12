/**
 * @file script.ts
 * @description Основной скрипт для чат-интерфейса
 */

export function sendMessage(): void {
  const input = document.getElementById('messageInput') as HTMLInputElement | null;
  const text = input?.value.trim();

  if (text) {
    addMessage(text, 'user');
    if (input) input.value = '';

    // Имитация ответа (потом заменим на invoke)
    setTimeout(() => {
      addMessage('Ответ системы на базе вашего JSON-конфига!', 'ai');
    }, 1000);
  }
}

export function addMessage(text: string, sender: 'user' | 'ai'): void {
  const chatContainer = document.getElementById('chatContainer') as HTMLElement | null;
  if (!chatContainer) return;

  const msg = document.createElement('div');
  msg.className = `message ${sender}-message`;
  msg.textContent = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

declare global {
  interface Window {
    sendMessage: typeof sendMessage;
    addMessage: typeof addMessage;
  }
}

if (typeof window !== 'undefined') {
  window.sendMessage = sendMessage;
  window.addMessage = addMessage;
}