import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import MarkdownIt from 'markdown-it';
import { useWowilonPanel } from '../useWowilonPanel';

export function useAiApp() {
  const searchParams = new URLSearchParams(window.location.search);
  const urlChatId = searchParams.get('chatId') || '';
  const urlProject = searchParams.get('project') || '';

  const isSettingsOpen = ref(false);
  const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
  const messagesContainer = ref<HTMLElement | null>(null);

  const activeChatId = ref(urlChatId);
  const currentProject = ref(urlProject);

  const { renderedMessages, isGenerating, sendMessage, loadMessages } = useWowilonPanel(
    { isOpen: true },
    () => {}
  );

  const renderMarkdown = (text: string) => md.render(text);

  const scrollToBottom = () => {
    void nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  };

  const handleSend = async (text: string) => {
    await sendMessage(text);
    scrollToBottom();
  };

  watch(activeChatId, (newId) => {
    if (newId) void loadMessages(newId);
  }, { immediate: true });

  watch(() => renderedMessages.value.length, scrollToBottom);

  const logClick = (event: Event) => {
    const mouseEvent = event as MouseEvent;
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const className = target.className || '(no class)';
    const id = target.id || '(no id)';
    const textContent = target.textContent?.trim().slice(0, 100) || '(empty)';
    const x = mouseEvent.clientX;
    const y = mouseEvent.clientY;
    const chatId = activeChatId.value;
    const project = currentProject.value;

    console.log(`[CHAT-CLICK] chatId=${chatId} project=${project} | (${x}, ${y}) | <${tagName}>.#${id}.${className} | "${textContent}"`);
  };

  onMounted(() => {
    const container = document.querySelector('.wowilon-app-container');
    const listener = logClick;
    if (container) {
      container.addEventListener('click', listener, true);
    } else {
      document.addEventListener('click', listener, true);
    }

    (window as unknown as { __chatClickListener?: { container: Element | null; listener: (e: Event) => void } }).__chatClickListener = { container, listener };
  });

  onUnmounted(() => {
    const stored = (window as unknown as { __chatClickListener?: { container: Element | null; listener: (e: Event) => void } }).__chatClickListener;
    if (stored?.container) {
      stored.container.removeEventListener('click', stored.listener, true);
    } else if (stored?.listener) {
      document.removeEventListener('click', stored.listener, true);
    }
  });

  return {
    isSettingsOpen,
    messagesContainer,
    renderedMessages,
    isGenerating,
    renderMarkdown,
    handleSend
  };
}
