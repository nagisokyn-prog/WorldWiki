<template>
  <div class="wowilon-wrapper" :class="{ active: isOpen }">
    <div class="wowilon-backdrop" @click="$emit('close')"></div>
    <div class="wowilon-panel">
      <div class="wowilon-header">
        <h3><i class="fas fa-robot"></i> WoWiLon AI</h3>
        <button class="close-panel-btn" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="wowilon-content">
        <div class="request-type-selector">
          <label>Тип запроса:</label>
          <select v-model="requestType">
            <option value="llm">Помощь LLM</option>
            <option value="search">Поиск по БД</option>
            <option value="rag">RAG WoWiLon</option>
          </select>
        </div>
        
        <div class="query-input-container">
          <textarea v-model="query" placeholder="Введите ваш запрос..." rows="3"></textarea>
          <button class="send-query-btn" :disabled="loading" @click="sendQuery">
            <i class="fas fa-paper-plane"></i> Отправить
          </button>
        </div>
        
        <div class="response-area">
          <div class="response-header">
            <span>Ответ:</span>
            <button class="clear-response-btn" @click="clearResponse">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          
          <div class="response-content">
            <div v-if="loading" class="loading-response">
              <i class="fas fa-spinner fa-spin"></i>
              <p>WoWiLon обрабатывает запрос...</p>
            </div>
            <div v-else-if="response" class="ai-response" v-html="response"></div>
            <div v-else class="empty-response">
              <i class="fas fa-comment-alt"></i>
              <p>Здесь появится ответ от WoWiLon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  isOpen: { type: Boolean, required: true }
});

const emit = defineEmits(['close']);

const requestType = ref('llm');
const query = ref('');
const response = ref('');
const loading = ref(false);

const sendQuery = () => {
  const text = query.value.trim();
  if (!text) {
    alert('Пожалуйста, введите запрос');
    return;
  }

  loading.value = true;
  
  // Имитация ответа (в будущем интеграция с API)
  setTimeout(() => {
    response.value = `
      <p><strong>WoWiLon AI:</strong> Это пример ответа от AI системы. В реальной реализации здесь будет интеграция с бэкендом.</p>
      <p>Тип запроса: ${requestType.value}</p>
      <p>Ваш запрос: "${text}"</p>
      <div class="response-meta">
        <small>Ответ сгенерирован: ${new Date().toLocaleString('ru-RU')}</small>
      </div>
    `;
    loading.value = false;
  }, 1500);
};

const clearResponse = () => {
  response.value = '';
  query.value = '';
};
</script>

<style scoped>
.wowilon-wrapper {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10000;
}

.wowilon-wrapper.active {
  pointer-events: auto;
}

.wowilon-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.3s var(--anim-ease);
  pointer-events: none;
}

.wowilon-wrapper.active .wowilon-backdrop {
  opacity: 1;
  pointer-events: auto;
}

.wowilon-panel {
  position: absolute;
  right: -400px;
  top: 0;
  width: 400px;
  height: 100vh;
  background: #0f0f12; /* Fully opaque */
  backdrop-filter: blur(var(--glass-blur));
  border-left: 1px solid var(--border-color);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
  transition: right 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.wowilon-wrapper.active .wowilon-panel {
  right: 0;
}

.wowilon-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
}

.wowilon-header h3 {
  margin: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
}

.close-panel-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

.close-panel-btn:hover {
  color: var(--text-main);
}

.wowilon-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  overflow-y: auto;
}

.request-type-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.request-type-selector select {
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-radius: 6px;
  outline: none;
}

.query-input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-input-container textarea {
  width: 100%;
  padding: 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-radius: 8px;
  resize: vertical;
  font-family: inherit;
  outline: none;
}

.query-input-container textarea:focus {
  border-color: var(--accent);
}

.send-query-btn {
  background: var(--accent);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  transition: background 0.2s;
}

.send-query-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-query-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.response-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.response-header {
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  font-size: 14px;
}

.clear-response-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.clear-response-btn:hover {
  color: #ef4444;
}

.response-content {
  flex: 1;
  padding: 15px;
  background: rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  min-height: 200px;
}

.empty-response, .loading-response {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: var(--text-muted);
  gap: 12px;
  text-align: center;
}

.empty-response i, .loading-response i {
  font-size: 24px;
  opacity: 0.5;
}

.ai-response {
  font-size: 14px;
  line-height: 1.6;
}

.ai-response p {
  margin-bottom: 10px;
}

.response-meta {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
  color: var(--text-muted);
}
</style>
