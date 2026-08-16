<template>
  <div class="wowilon-header">
    <div class="header-left">
      <div class="wowilon-title">
        <i class="fas fa-robot"></i>
        <span class="title-text">WoWiLon AI</span>
      </div>
      
      <div class="mode-switcher">
        <button 
          :class="{ active: currentMode === 'chat' }" 
          title="Собеседник (Только чтение)"
          @click="setMode('chat')"
        >
          <i class="fas fa-comments"></i>
        </button>
        <button 
          :class="{ active: currentMode === 'edit' }" 
          title="Редактор (Чтение + Запись)"
          @click="setMode('edit')"
        >
          <i class="fas fa-edit"></i>
        </button>
        <button 
          :class="{ active: currentMode === 'analyze' }" 
          title="Аналитик (Сложные отчёты)"
          @click="setMode('analyze')"
        >
          <i class="fas fa-chart-line"></i>
        </button>
      </div>
    </div>

    <div class="wowilon-actions">
      <button class="action-btn" title="Настройки ИИ" @click="$emit('open-settings')">
        <i class="fas fa-cog"></i>
      </button>
      
      <!-- Show detach only if we are not already detached -->
      <button v-if="!isDetached" class="action-btn" title="Открепить окно" @click="$emit('detach')">
        <i class="fas fa-external-link-alt"></i>
      </button>
      <button v-if="!isDetached" class="action-btn close-btn" title="Закрыть" @click="$emit('close')">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps({
  isDetached: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close', 'detach', 'open-settings']);

const currentMode = ref('chat');

const setMode = (mode: string) => {
  currentMode.value = mode;
  // TODO: Trigger agent mode change
};
</script>

<style scoped>
.wowilon-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-header);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.wowilon-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--accent);
}

.title-text {
  font-size: 14px;
}

.mode-switcher {
  display: flex;
  background: var(--bg-input);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid var(--border-color);
}

.mode-switcher button {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.mode-switcher button:hover {
  color: var(--text-main);
}

.mode-switcher button.active {
  background: var(--accent);
  color: white;
}

.wowilon-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: var(--bg-surface);
  color: var(--text-main);
}

.close-btn:hover {
  background: rgba(250, 82, 82, 0.1);
  color: var(--danger);
}
</style>
