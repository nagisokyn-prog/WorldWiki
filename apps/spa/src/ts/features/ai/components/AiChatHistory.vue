<template>
  <div class="chat-history-sidebar">
    <div class="history-header">
      <h3>История чатов</h3>
      <button class="new-chat-btn" @click="$emit('new-chat')" title="Новый чат">
        <i class="fas fa-edit"></i>
      </button>
    </div>

    <div class="history-search">
      <input type="text" v-model="searchQuery" class="input-base" placeholder="Поиск чатов...">
    </div>

    <div class="history-list">
      <div 
        v-for="chat in filteredChats" 
        :key="chat.id"
        class="chat-item"
        :class="{ active: activeChatId === chat.id }"
        @click="$emit('select-chat', chat.id)"
      >
        <div class="chat-icon">
          <i class="fas fa-comment-alt"></i>
        </div>
        <div class="chat-details">
          <div class="chat-title">{{ chat.title }}</div>
          <div class="chat-meta">
            <span v-if="chat.tag" class="chat-tag">{{ chat.tag }}</span>
            <span class="chat-date">{{ chat.date }}</span>
          </div>
        </div>
      </div>
      
      <div v-if="filteredChats.length === 0" class="empty-state">
        Нет чатов
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps({
  activeChatId: String
});

defineEmits(['select-chat', 'new-chat']);

const searchQuery = ref('');

// MOCK DATA for now
const mockChats = [
  { id: '1', title: 'Создание персонажа: Гарри', tag: 'персонаж', date: 'Сегодня, 14:20' },
  { id: '2', title: 'Обсуждение концовки Тома 1', tag: 'сюжет', date: 'Вчера, 18:45' },
  { id: '3', title: 'Логика магии воды', tag: 'миростроение', date: '3 авг, 10:15' }
];

const filteredChats = computed(() => {
  if (!searchQuery.value) return mockChats;
  const q = searchQuery.value.toLowerCase();
  return mockChats.filter(c => 
    c.title.toLowerCase().includes(q) || 
    (c.tag && c.tag.toLowerCase().includes(q))
  );
});
</script>

<style scoped>
.chat-history-sidebar {
  width: 250px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.history-header {
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.history-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.new-chat-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.new-chat-btn:hover {
  background: rgba(139, 92, 246, 0.1);
}

.history-search {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
}

.input-base {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
}

.input-base:focus {
  border-color: var(--accent);
  outline: none;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid transparent;
}

.chat-item:hover {
  background: var(--bg-surface);
}

.chat-item.active {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.2);
}

.chat-icon {
  color: var(--text-muted);
  font-size: 12px;
  padding-top: 2px;
}

.chat-item.active .chat-icon {
  color: var(--accent);
}

.chat-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.chat-title {
  font-size: 13px;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.chat-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.chat-tag {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.chat-date {
  color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
